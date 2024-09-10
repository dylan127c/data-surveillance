import { BrowserWindow } from 'electron';
import fs from "node:fs";
import path from 'node:path';
import puppeteer, { Browser, ElementHandle, Page } from 'puppeteer';
import { getTime } from './utils/dateUtil';
import { verify } from './verification';

/** 用于检查伪加载状态的选择器 */
const MASK_CONTENT_SELECT = "div#maskcontent";
/** 用于检查伪加载覆盖的选择器 */
const MASK_OVERLAY_SELECT = "div#mask-img";
/** 用于查找记录诉求、催单或投诉数量元素的选择器 */
const ROWS_COUNTER_SELECT = "span#s_1_rc.siebui-row-counter";
/** 用于查找下拉列表元素的选择器 */
const DROP_OPTIONS_SELECT = "select[title='已保存的查询'] option";
/** 用于检查是否存在登录错误元素的选择器 */
const WHAT_RESULTS_SELECT = "div#statusBar";

const params = {
    logon: {
        nameSelect: "input[title='用户 ID']",
        codeSelect: "input[title='密码']",
        signSelect: "img[alt='登录']",
    },
    page: {
        mainSelect: "span[title='诉求']"
    },
    request: {
        target: "a[data-tabindex='tabView0']",
        verify: "li[aria-label='诉求单列表 已选择']",
        option: "未处理紧急诉求（本日）",
        output: "诉求 - 未处理紧急诉求（本日）",
    },
    grumble: {
        target: "a[data-tabindex='tabView2']",
        verify: "li[aria-label='投诉 已选择']",
        output: "投诉 - 本日创建的诉求（新建）",
        prefix: "_s_1_l_FT_Process_Status",
    },
    exigent: {
        target: "a[data-tabindex='tabView8']",
        verify: "li[aria-label='催单记录 已选择']",
        output: "催单 - 当日催单诉求（未处理）",
        prefix: "_s_1_l_FT_Collection_Result",
    },
    logout: {
        settingSelect: "li[title='设置']",
        signoutSelect: "button[un='注销']",
    }
};

/** 日志类型指示，同时作为日志内容输出 */
const TYPE = {
    INFO: "[ INFO]",
    FAIL: "[ FAIL]",
}
/** 用于指示日志输出的位置为 Process.vue、Message.vue 还是 Options.vue */
const DEST = {
    PROCESS: "process",
    MESSAGE: "message",
    OPTIONS: "options"
}

let win: BrowserWindow | null;
let browser: Browser | null;
let page: Page | null;

/**
 * 终止信号。
 * 
 * 主动或被动导致程序终止时，此参数会被设置为 true 值。
 * 
 * @see {@link stop}
 * @see {@link terminateCheck}
 */
let signal: boolean = false;

/**
 * 主要目的是让 main.js 可以更改全局变量 {@link signal} 的值。
 * 
 * 这里声明成异步函数宏观上快一点。但实际 JS 是单线程，微观来说应该没变化。
 * 
 * - 宏观：异步编程能使程序在等待异步操作时执行其他代码，从而提高总体效率和响应性。
 * - 微观：JavaScript 仍然是单线程的，异步操作和 await 可以使得代码逻辑更清晰，但不会显著改变底层的线程执行机制。
 */
export async function stop() {
    signal = true;
}

/**
 * 主动或被动终止程序所需携带的错误信息，此错误信息能够让 main.js 正确地结束程序循环。
 * 
 * @see {@link terminateCheck} 
 */
const FROM_TERMINATE = "Just another day.";
/**
 * 检查是否存在主动或被动终止程序的行为，此函数会在多个步骤中被频繁调用。
 * 
 * 检查 {@link signal} 终止信号，存在信号时抛出带有特殊错误信息 {@link FROM_TERMINATE} 的错误。
 */
async function terminateCheck() {
    if (signal) {
        signal = false;
        win?.webContents.send(DEST.PROCESS,
            `${getTime()} ${"[ STOP]"} ${"terminateCheck =>"} ${"终止信号已被接收。"}`);
        await terminate();
        throw new Error(FROM_TERMINATE); // THROWN:
    }
}

/**
 * 启动函数，由 main.js 启动循环并调用。
 * 
 * @param url 目标网址
 * @param username 用户名称
 * @param passcode 登录密码
 * @param window Electron 窗体对象
 */
export async function start(
    url: string,
    username: string,
    passcode: string,
    window: BrowserWindow
) {
    // *.实测 sniff.ts 不能直接访问 Electron 环境下的 window 全局变量
    // *.由于 window 不会变，实际只需在首次启动监控时会为 win 进行赋值
    if (!win) {
        win = window;
    }

    win?.webContents.send(DEST.PROCESS, `${getTime()} ${"[START]"} ${"目标网址："}${url}`);
    win?.webContents.send(DEST.PROCESS, `${getTime()} ${"[START]"} ${"用户名称："}${username}`);
    win?.webContents.send(DEST.PROCESS, `${getTime()} ${"[START]"} ${"登录密码："}${passcode}`);
    await terminateCheck();

    try {
        await init();
        await logon(url, username, passcode);
        await redirect();
        await action();
    } catch (error) {
        /**
         * 函数 {@link terminateCheck} 会抛出带有特殊错误信息 {@link FROM_TERMINATE} 的错误。
         * 
         * 1.下层抛出错误，但非 terminateCheck() 引起，则大概率不存在终止程序的信号，错误会被直接抛出；（上层 main.js 将重启程序）
         * 2.下层抛出错误，且由 terminateCheck() 引起，则表示目前存在终止程序的信号，错误会被直接抛出；（上层 main.js 将终止程序）
         * 
         * 特殊：下层抛出错误，且非 terminateCheck() 引起，但本层 terminateCheck() 意外引发主动抛出错误，则表示这个瞬间接收了
         * 从外部发来的终止信号，那么本层 terminateCheck() 将主动抛出错误。（上层 main.js 将终止程序）
         */
        await terminateCheck();
        throw error; // THROWN:
    }
};

/**
 * 函数会顺序在 pro、dev 和 ~/.cache 中查找目标浏览器程序。
 * 
 * - Puppeteer 自 v22 版本后 chrome.exe 同样支持“无头模式”，保持 headless: true 即可。
 * 
 * Puppeteer 实际支持普通的 Chrome 浏览器，只需要指定浏览器路径即可，但使用普通浏览器
 * 可能导致兼容性错误，因此还是推荐使用 Puppeteer 提供的浏览器程序。
 * 
 * @returns 用于创建 {@link BrowserWindow} 对象的 executablePath 值
 */
function envCheck(): string {
    const defaultPro = "./resources/chromium/chrome-headless-shell.exe"; // *.PRODUCE/HEADLESS-SHELL
    const reservePro = "./resources/chromium/chrome.exe"; // *.PRODUCE/CHROME-HEADLESS
    const defaultDev = "./src/chromium/chrome-headless-shell.exe"; // *.DEVELOP/HEADLESS-SHELL
    const reserveDev = "./src/chromium/chrome.exe"; // *.DDEVELOP/CHROME-HEADLESS

    if (fs.existsSync(path.resolve(defaultPro))) {
        info(`${"env =>"} ${defaultPro}`);
        return defaultPro;
    } else if (fs.existsSync(path.resolve(reservePro))) {
        info(`${"env =>"} ${reservePro}`);
        return reservePro;
    } else if (fs.existsSync(path.resolve(defaultDev))) {
        info(`${"env =>"} ${defaultDev}`);
        return defaultDev;
    } else if (fs.existsSync(path.resolve(reserveDev))) {
        info(`${"env =>"} ${reserveDev}`);
        return reserveDev;
    }

    info(`${"env => ~/.cache/puppeteer"}`)
    return "";
}

/**
 * 初始化全局的 browser 和 page 变量。
 */
async function init() {

    // *.启动浏览器
    if (!browser) {
        browser = await puppeteer.launch({
            // *.指定浏览器 .exe 程序的路径
            executablePath: envCheck(),
            defaultViewport: {
                width: 1280,
                height: 720,
            },
            // *.Puppeteer 在 v22 版本之后，如不指定任何 executalbePath 则 headless: true 默认使用 chrome.exe 提供的新“无头模式”
            // *.同时 v22 新增了 headless: shell 选项，以让用户继续使用旧版 chrome-headless-shell.exe 执行“无头模式”
            headless: true,
            // *.Puppeteer 默认使用 ws 通信，但和 Electron-Forge 整合时由于冲突，需要改用 pipe 通信
            pipe: true,
        }).catch(async (error) => {
            // *.没有找到必要的浏览器程序时，需要终止程序避免 main.js 无限循环
            if (error.message.includes("Could not find Chrome")) {
                fail(`${"init =>"} ${"浏览器定位失败，程序即将终止。"}`);
                // *.通知 Options.vue 页面在程序完成终止前，禁用部分按钮功能
                win?.webContents.send(DEST.OPTIONS, "\u0064\u0079\u006C\u0061\u006E\u0031\u0032\u0037\u0063");
                await terminate();
                throw new Error("NOT-FIND-CHROME");
            }
            // *.如果浏览器存在但启动失败，则抛出错误以重启
            fail(`${"init =>"} ${"浏览器启动失败，正在恢复。"}`);
            throw error; // THROWN:
        });
    }
    info(`${"init =>"} ${"浏览器启动完毕。"}`);
    await terminateCheck();
    await wait(2000);

    // *.新建标签页
    if (!page) {
        page = await browser.newPage().catch((error) => {
            // *.标签页启动失败可以选择提前先把 browser 变量复位
            browser = null;
            fail(`${"init =>"} ${"新建标签页失败，正在恢复。"}`);
            throw error; // THROWN:
        });
    }
    info(`${"init =>"} ${"新建标签页完毕。"}`);
    await terminateCheck();
    await wait(500);
}

/**
 * 检查任意对象是否为 null 值，并执行指定操作（callback）。
 * 
 * @param item 检查对象
 * @param callback 回调函数（同步异步均可用）
 */
async function safelyUse<T>(item: T | null, callback: (item: T) => void) {
    if (item !== null) {
        // *.TS 编译器会提示 await 不需要添加，但实际上这里的 callback 需要是异步函数
        // *.保留 await 关键字，并确保在传入的回调函数上添加了 async 关键字以声明异步
        await callback(item);
    } else {
        throw new Error(); // THROWN:
    }
}

/**
 * 登录函数。
 * 
 * @param url 目标网址
 * @param username 用户名称
 * @param passcode 登录密码
 */
async function logon(url: string, username: string, passcode: string) {

    try {
        // *.可选提供必要的用户校验逻辑
        await verify(username, win, DEST.PROCESS, DEST.OPTIONS);
    } catch (error) {
        // *.若验证失败，程序将终止运行
        await terminate();
        throw error;
    }

    await safelyUse(page, async (page) => {
        // *.打开登录系统的页面
        await page.goto(url, {
            waitUntil: "domcontentloaded"
        }).catch((error) => {
            // *.使用 Headless 模式时，诸如 404/500 等状态码都不会触发异常
            // *.检查是否存在登录必要的 HTML 元素，来判断登录页面是否正常打开
        });
        info(`${"logon =>"} ${"正在进入登录页面。"}`);
        await terminateCheck();
        await wait(5000);

        try {
            // *.检查登录必要的 HTML 元素是否均加载完毕
            await Promise.all([
                // *.使用 Promise.all 确保选择器同时存在（内部并行执行）时不需要添加 await 关键字
                // *.内部所有的 waitForSelector 建议加上超时检测，Promise.all 检查时间取决于最长的时间
                page.waitForSelector(params.logon.nameSelect, { timeout: 2000 }),
                page.waitForSelector(params.logon.codeSelect, { timeout: 2000 }),
                page.waitForSelector(params.logon.signSelect, { timeout: 2000 }),
            ]);
        } catch (error) {
            fail(`${"logon =>"} ${"登录页面加载失败，程序自动恢复中"}`);
            throw error; // THROWN:
        }
        info(`${"logon =>"} ${"登录页面加载完毕。"}`);

        // *.输入用户信息并登录系统（登录过程可能耗时较长）
        // *.函数 locator 不存在超时检测机制，但上一步 waitForSelector 能够保证所需 HTML 元素都已存在
        // *.注意 fill 函数返回一个 Promise 对象，需要添加 await 关键字以同步执行
        await page.locator(params.logon.nameSelect).fill(username);
        await page.locator(params.logon.codeSelect).fill(passcode);
        const imgLogon = await page.$(params.logon.signSelect);
        // *.通过 img 元素来定位其父元素 a
        // *.TS 无法推断 aLogon 对象的实际 HTML 类型时，需要使用 as 关键字指定对象类型
        const aLogon = await page.evaluateHandle(
            el => el?.parentElement, imgLogon
        ) as ElementHandle<HTMLAnchorElement>;
        // *.这里的 aLogon 对象实际为 ElementHandle<HTMLAnchorElement> 类型
        // *.只有拥有 click 函数的对应类型，才能够调用 click 方法并通过编译检查
        await aLogon.click();
        info(`${"logon =>"} ${"正在登录系统。"}`);

        // FIXME: 存在一个问题，可能出现错误然后直接调到 main.js 那重启程序而没有任何日志输出

        // *.检查跳转至诉求页面必要的 HTML 元素是否加载完毕（存在即登录成功）
        await page.waitForSelector(params.page.mainSelect, { timeout: 8000 })
            .catch(async (error) => {
                // *.如果检查不到首页必要元素，即表明首页超时未成功加载，判断是否存在登录失败的可能
                await page.waitForSelector(WHAT_RESULTS_SELECT, { timeout: 1000 })
                    .then(async () => {
                        // *.查询是不是登录失败
                        const divStatus = await page.$(WHAT_RESULTS_SELECT);
                        const textStatusHandle = await page.evaluateHandle(el => el?.innerText, divStatus);

                        // *.函数 jsonValue 返回一个 Promise 对象，需要使用 await 等待该函数返回一个 string 类型值
                        const textStatus = await textStatusHandle.jsonValue() as string;
                        if (textStatus.includes("密码有误")) {
                            fail(`${"logon =>"} ${"用户标识或密码有误，请检查后重试。"}`);
                            win?.webContents.send(DEST.OPTIONS, "\u0064\u0079\u006C\u0061\u006E\u0031\u0032\u0037\u0063");
                            await terminate();
                            throw new Error("USERNAME-OR-PASSCODE");
                        }
                    })
                    .catch(async (error) => {
                        // *.这里的 catch 会捕捉 then 中出现的异常，实际在用户或密码有误时，程序并不会自动恢复
                        if (!(error.message === "USERNAME-OR-PASSCODE")) {
                            // *.如果不存在登录错误元素的选择器，即表明是登录成功、但首页长时间无法加载出来的情况
                            fail(`${"logon =>"} ${"系统首页加载失败，程序自动恢复中。"}`);
                        }
                        throw error; // THROWN:
                    });
                // *.因为 WHAT_RESULTES_SELECT 存在，只会出现“找到”和“找不到”两种情况
                // *.这意味着要么执行 then 操作，要么执行 catch 操作，一旦缺失 catch 代码块，那么在“找不到”时会直接抛出错误
                // *.同时又因为 then 会主动抛出错误，这表示 waitForSelector(WHAT_RESULTS_SELECT) 之后的代码完全没有执行机会
            });
        await checkMask([1500, 2500]);
    });
    info(`${"logon =>"} ${"登录成功。"}`);
    await terminateCheck();
}

async function redirect() {
    await safelyUse(page, async (page) => {
        info(`${"redirect =>"} ${"正在跳转至诉求页面。"}`)
        const spanMainPage = await page.$(params.page.mainSelect)
            .catch(error => {
                // *.一定存在，检查当前页面的选择器是否存在是登录逻辑的一部分
                throw error; // THROWN:
            });
        const aMainPage = await page.evaluateHandle(
            el => el?.parentElement, spanMainPage
        ) as ElementHandle<HTMLAnchorElement>;
        await aMainPage.click();
        await checkMask([2000, 1000]);

        try {
            // *.检查查询所必要的 HTML 元素是否均加载完毕
            await Promise.all([
                page.waitForSelector(params.request.target, { timeout: 2000 }),
                page.waitForSelector(params.grumble.target, { timeout: 2000 }),
                page.waitForSelector(params.exigent.target, { timeout: 2000 }),
            ]);
        } catch (error) {
            fail(`${"redirect =>"} ${"诉求页面加载失败，程序自动恢复中。"}`);
            throw error; // THROWN:
        }
    });
    info(`${"redirect =>"} ${"诉求页面加载完毕。"}`);
    await terminateCheck();
}

async function action() {
    try {
        while (true) {
            await request();
            await wait(2500);

            await grumble();
            await wait(2500);

            await exigent();
            await wait(2500);
        }
    } catch (error) {
        if (error.message !== FROM_TERMINATE) {
            fail(`${"action =>"} ${"程序运行异常，正在自动恢复。"}`);
        }
        // *.将错误抛出并交由上层方法判断是否需要重新启动
        throw error; // THROWN:
    }
}

async function request() {
    await safelyUse(page, async (page) => {
        info(`${"request =>"} ${"正在进行诉求查询。"}`);
        await page.waitForSelector(params.request.target, { timeout: 1000 })
            .catch(error => {
                // *.一定存在，检查当前页面的选择器是否存在是跳转逻辑的一部分
                throw error; // THROWN:
            });

        // *.定位[诉求单列表]
        await page.locator(params.request.target).click();

        // *.尽量多次检测确保跳转操作可靠性
        await checkMask([1000, 500]);
        await checkMask([1000, 500]);
        await page.waitForSelector(params.request.verify, { timeout: 2000 })
            .catch(error => {
                // FIXME: 疑似跳转行为是替换整个包含列表的 div，这种情况下认证选择器也许是可靠的
                // FIXME: 需要待运行一段时间后才能证实猜想
                throw error;
            });

        // *.查询[今日诉求]，模拟选择下拉菜单
        await page.$$eval(DROP_OPTIONS_SELECT, (options, params) => {
            return options.forEach(option => {
                if (option.innerText === params.request.option) {
                    option.selected = true;
                    option.click();
                    return;
                }
            })
        }, params).catch(error => {
            // *.由于 DROP_OPTIONS_SELECT 必然存在，除非手动终止程序，否则不可能出现错误
        });
        // *.页面跳转较为可靠的情况下，暂时可以不考虑位于错误页面时滚动下拉菜单可能存在的问题
        await checkMask([2000, 500]);

        // *.检查[今日诉求]页面是否加载完毕
        for (let loop = 0; loop < 10; loop++) {
            const divStatus = await page.$(MASK_CONTENT_SELECT);
            const textStatusHandle = await page.evaluateHandle(el => el?.innerText, divStatus);

            // *.函数 jsonValue 返回一个 Promise 对象，需要使用 await 等待该函数返回一个 string 类型值
            const textStatus = await textStatusHandle.jsonValue() as string;
            if (textStatus === ("完成")) break;

            await terminateCheck();
            // *.失败时等待 1.5 秒，最多重复 10 次
            await wait(1500);
        }

        // *.输出[诉求结果]
        const spanRequest = await page.$(ROWS_COUNTER_SELECT);
        const textRequestHandle = await page.evaluateHandle(el => el?.innerText, spanRequest);
        const textRequest = textRequestHandle.toString();

        let finalRequest = 0;
        if (!textRequest.includes("无记录")) {
            const match = textRequest.match(/(?<=JSHandle:)(\d*)/i);
            if (match && match[1]) {
                finalRequest = parseInt(match[1], 10);
            }
        }
        msg(`${params.request.output}${":"} ${finalRequest}`);
    });
    await terminateCheck();
}

async function grumble() {
    await safelyUse(page, async (page) => {
        info(`${"grumble =>"} ${"正在进行投诉查询。"}`);
        await page.waitForSelector(params.grumble.target, { timeout: 1000 })
            .catch(error => {
                // *.一定存在，检查当前页面的选择器是否存在是跳转逻辑的一部分
                throw error; // THROWN:
            });

        // *.定位[投诉]
        await page.locator(params.grumble.target).click();

        // *.尽量多次检测确保跳转操作可靠性
        await checkMask([1000, 500]);
        await checkMask([1000, 500]);
        await page.waitForSelector(params.grumble.verify, { timeout: 2000 })
            .catch(error => {
                // FIXME: 疑似跳转行为是替换整个包含列表的 div，这种情况下认证选择器也许是可靠的
                // FIXME: 需要待运行一段时间后才能证实猜想
                throw error;
            });

        // *.输出[投诉结果]
        const spanGrumble = await page.$(ROWS_COUNTER_SELECT);
        const textGrumbleHandle = await page.evaluateHandle(el => el?.innerText, spanGrumble);
        const textGrumble = textGrumbleHandle.toString();

        let finalGrumble = 0;
        if (!textGrumble.includes("无记录")) {
            const match = textGrumble.match(/(?<=JSHandle:)(\d*)/i);
            if (match && match[1]) {
                finalGrumble = parseInt(match[1], 10);
            }
        }

        let countGrumble = 0;
        for (let index = 1; index <= finalGrumble; index++) {
            const resultSelect = "td[id='" + index + params.grumble.prefix + "']";
            const tdGrumble = await page.$(resultSelect) as ElementHandle<HTMLTableCellElement>;
            const statusGrumbleHandle = await page.evaluateHandle(el => el?.innerText, tdGrumble);
            const statusGrumble = await statusGrumbleHandle.jsonValue() as string;
            if (statusGrumble === "新建") {
                countGrumble++;
            }
        }
        msg(`${params.grumble.output}${":"} ${countGrumble}`);
    });
    await terminateCheck();
}

async function exigent() {
    await safelyUse(page, async (page) => {
        info(`${"exigent =>"} ${"正在进行催单查询。"}`)
        await page.waitForSelector(params.exigent.target, { timeout: 1000 })
            .catch(error => {
                // *.一定存在，检查当前页面的选择器是否存在是跳转逻辑的一部分
                throw error; // THROWN:
            });

        // *.定位[催单记录]
        await page.locator(params.exigent.target).click();

        // *.尽量多次检测确保跳转操作可靠性
        await checkMask([1000, 500]);
        await checkMask([1000, 500]);
        await page.waitForSelector(params.exigent.verify, { timeout: 2000 })
            .catch(error => {
                // FIXME: 疑似跳转行为是替换整个包含列表的 div，这种情况下认证选择器也许是可靠的
                // FIXME: 需要待运行一段时间后才能证实猜想
                throw error;
            });

        // *.输出[催单结果]
        const spanExigent = await page.$(ROWS_COUNTER_SELECT);
        const textExigentHandle = await page.evaluateHandle(el => el?.innerText, spanExigent);
        const textExigent = textExigentHandle.toString();

        let finalExigent = 0;
        if (!textExigent.includes("无记录")) {
            const match = textExigent.match(/(?<=JSHandle:)(\d*)/i);
            if (match && match[1]) {
                finalExigent = parseInt(match[1], 10);
            }
        }

        let countExigent = 0;
        for (let index = 1; index <= finalExigent; index++) {
            const resultSelect = "td[id='" + index + params.exigent.prefix + "']";
            const tdExigent = await page.$(resultSelect) as ElementHandle<HTMLTableCellElement>;
            const statusExigentHandle = await page.evaluateHandle(el => el?.innerText, tdExigent);
            const statusExigent = await statusExigentHandle.jsonValue() as string;
            if (statusExigent === "未处理") {
                countExigent++;
            }
        }
        msg(`${params.exigent.output}${":"} ${countExigent}`);
    });
    await terminateCheck();
}

/**
 * 核心函数，用于清理程序，此函数不允许抛出任何错误（必须成功）。
 * 
 * 主动或被动终止程序、或程序异常时，需要执行此函数以重置 {@link browser}、
 * {@link page} 等全局变量的值，以更好地管理内存（释放内存）。
 */
export async function terminate() {
    try {
        win?.webContents.send(DEST.PROCESS,
            `${getTime()} ${"[ STOP]"} ${"terminate =>"} ${"正在终止程序。"}`);
    } catch (error) {
        // *.不允许抛出错误
    }
    try {
        await safelyUse(page, async (page) => {
            try {
                // *.注销/退出系统
                await page.waitForSelector(MASK_OVERLAY_SELECT, { hidden: true, timeout: 2000 });
                await page.waitForSelector(params.logout.settingSelect, {
                    timeout: 500
                }).then(async () => {
                    await page.locator(params.logout.settingSelect).click();
                });
                // *.注销按钮首次需要通过点按设置按钮以生成
                await page.waitForSelector(params.logout.signoutSelect, {
                    visible: true,
                    timeout: 1000
                }).then(async () => {
                    await page.locator(params.logout.signoutSelect).click();
                });
            } catch (error) {
                // *.清理程序内的“注销/退出系统”逻辑，只是为了更符合人类行为
                // *.由于后续浏览器会关闭，因此所有错误都可以静默处理
            }
            await wait(1000);

            try {
                // *.检查登录的必要元素是否加载完毕以检查是否已注销登录
                await Promise.all([ // *.异步执行最多消耗2秒
                    page.waitForSelector(params.logon.nameSelect, { timeout: 2000 }),
                    page.waitForSelector(params.logon.codeSelect, { timeout: 2000 }),
                    page.waitForSelector(params.logon.signSelect, { timeout: 2000 }),
                ]);
            } catch (error) {
                // *.用于再次确认是否已经完全退出，即便失败也无所谓
                // *.由于后续浏览器会关闭，因此所有错误都可以静默处理，
            }
        });
    } catch (error) {
        // *.所有从 terminate() 抛出的错误都会引起 main.js 异常工作
        // *.清理工作在 page 不可用时，仍能正常执行，错误可以静默处理
    }

    /**
     * *.浏览器意外关闭时，变量 browser、page 如果已经进行了赋值，那么它们将不为 null 值。
     *        这种情况被允许进入 if 代码块，导致调用 close() 函数出错的现象。
     * 
     * *.这里 terminate() 方法需要确保 browser、page 变量能够复位且不报错，简单处理的话，
     *        可以选择将包含 close() 代码加入到上面 try-catch 代码块中。
     * 
     * *. 但如果需要更清晰的日志信息，额外的 try-catch 代码块是更好的选择。
     */

    try {
        if (page) {
            await page.close();
            win?.webContents.send(DEST.PROCESS,
                `${getTime()} ${"[ STOP]"} ${"terminate =>"} ${"标签页已关闭。"}`);
        }
    } catch (error) {
        fail(`${"terminate =>"} ${"检测到标签页异常关闭错误。"}`);
    }
    page = null; // *.复位

    try {
        if (browser) {
            await browser.close();
            win?.webContents.send(DEST.PROCESS,
                `${getTime()} ${"[ STOP]"} ${"terminate =>"} ${"浏览器已关闭。"}`);
        }
    } catch (error) {
        fail(`${"terminate =>"} ${"检测到浏览器异常关闭错误。"}`);
    }
    browser = null; // *.复位

    try {
        win?.webContents.send(DEST.PROCESS,
            `${getTime()} ${"[ STOP]"} ${"terminate =>"} ${"程序终止，参数已复位。"}`);
    } catch (error) {
        // *.不允许抛出错误
    }
}

/**
 * 当前线程需要同步等待的时间，单位毫秒。
 * 
 * 返回类型即为 Promise 对象，因此函数不需要添加 async 关键字。
 * 
 * @param {number} time 时间（毫秒） 
 * @returns {Promise<string>} 返回一个在指定时间后解析为“resolved”的 Promise 对象
 */
function wait(time: number): Promise<string> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve('resolved');
        }, time);
    });
}

/**
 * 让线程同步等待的同时检测必要的 HTML 元素是否存在。
 * 
 * @param {number[]} times 包含两个时间值的数组
 */
async function checkMask(times: number[]) {
    try {
        // *.不能用 forEach 因为它的回调函数是异步的，即无法保证线程同步
        for (const time of times) {
            await terminateCheck();
            await wait(time);
            await terminateCheck();
            await page?.waitForSelector(MASK_OVERLAY_SELECT, { hidden: true, timeout: 2000 });
        }
    } catch (error) {
        if (error.message !== FROM_TERMINATE) {
            fail(`${"checkMask =>"} ${"网络故障或系统异常。"}`);
        }
        throw error; // THROWN:
    }
}

/**
 * 将 INFO 日志信息传输并发送给 .vue 页面。
 * 
 * @param {string} message 日志信息
 */
function info(message: string) {
    log(TYPE.INFO, message);
}

/**
 * 将 FAIL 日志信息传输并发送给 .vue 页面。
 * 
 * @param {string} message 日志信息
 */
function fail(message: string) {
    log(TYPE.FAIL, message);
}

/**
 * 将日志信息传输并发送给 Process.vue 页面。
 * 
 * @param {string} type 日志类型
 * @param {string} message 日志信息
 */
function log(type: string, message: string) {
    win?.webContents.send(
        DEST.PROCESS,
        `${getTime()} ${type} ${message}`
    );
}

/**
 * 将日志信息传输并发送给 Message.vue 页面。
 * 
 * @param {string} message 日志信息
 */
function msg(message: string) {
    win?.webContents.send(
        DEST.MESSAGE,
        `${message}`
    );
}