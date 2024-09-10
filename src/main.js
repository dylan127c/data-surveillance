const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell } = require('electron');
const path = require('node:path');
import { start, stop, terminate } from './sniff.ts';
import { getTime } from './utils/dateUtil';

// *.Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

/**
 * 缩放因子。默认屏幕缩放比例为 100% 时，程序缩放比例达到 150% 显示效果最佳。
 * 
 * 屏幕缩放比例越高，体现为放大效果。这时程序界面的整体比例应该对应缩小，即
 * 窗体尺寸和显示内容均要缩小，表现为缩放比例降低。
 */
const ADAPT_FACTOR = 2.5;
/** 系统信息代码，用于阻止系统菜单弹出。 */
const WM_INITMENU = 0x0116; // *.IMPORTANT!!!

let mainWindow, miniWindow;

function createMainWindow() {

  // *.获取当前屏幕的缩放比例因子
  const primaryDisplay = screen.getPrimaryDisplay();
  const scaleFactor = primaryDisplay.scaleFactor;

  // *.计算程序实际缩放比例
  const zoomFactor = ADAPT_FACTOR - scaleFactor;

  const defaultWidth = 800 * zoomFactor;
  const defaultHeight = 600 * zoomFactor;

  // *.创建浏览器窗口
  mainWindow = new BrowserWindow({
    // *.创建窗口的 width 和 height 参数不支持浮点入参！
    width: Math.ceil(defaultWidth),
    height: Math.ceil(defaultHeight),
    resizable: false,
    maximizable: false,
    frame: false,
    useContentSize: false,
    webPreferences: {
      // *.是否允许在 renderer.js 中使用 Node.js 的 API
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    // *.关闭 show 参数配合 ready-to-show 事件，可以更加流畅地显示窗口
    show: false,
    icon: path.join(__dirname, "./assets/icons/favicon.ico"),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
  });

  // *.Open the DevTools
  // mainWindow.webContents.openDevTools();

  // *.指示开发环境和生产坏境使用不同位置的 index.html 主页
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(path.join(MAIN_WINDOW_VITE_DEV_SERVER_URL, `/src/index.html`));
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // *.指示页面渲染完成并窗口可以被显示时触发
  mainWindow.once("ready-to-show", () => {
    // *.让显示内容（HTML）按实际缩放比例呈现
    mainWindow.webContents.setZoomFactor(zoomFactor);
    mainWindow.show();
  });

  // *.显示窗口的同时每次都要让显示内容（HTML）按实际缩放比例重新呈现
  mainWindow.on('show', () => {
    mainWindow.webContents.setZoomFactor(zoomFactor);
  });

  // *.释放内存
  mainWindow.on('closed', () => {
    // *.注意不要把 mainWindow 声明为 const 变量
    mainWindow = null;
  });

  /**
   * 在某些平台（Windows）上, 可拖拽区域将被视为 non-client frame 区域，
   * 右键单击这些区域时, 系统菜单必然弹出，导致自定义菜单将失效。
   * 
   * GitHub 普遍认为是 frame: false 参数引起的问题：
   * 
   * - https://github.com/electron/electron/issues/24893#issuecomment-1109262719
   * - https://github.com/electron/electron/issues/26726#issuecomment-2058524167
   * 
   * 上述链接中提供了一个解决方法，有效！但原理未知。
   */
  mainWindow.hookWindowMessage(WM_INITMENU, () => {
    // *.先禁用窗口再启用窗口，即可阻止系统菜单弹出
    mainWindow.setEnabled(false);
    mainWindow.setEnabled(true);

    // *.可选让自定义的 Menu 菜单弹出
    // YOUR_MENU.popup();
  });

  // *.监听窗口的 close 事件，以实现“最小化至托盘”的逻辑
  mainWindow.on('close', (event) => {
    // *.阻止窗口触发 close 事件的默认行为
    // *.这意味着此窗口的 window.close() 函数无法完成退出程序的操作！
    event.preventDefault();

    // *.隐藏窗口
    mainWindow.hide();
  });

  // *.启用托盘及图标设置
  const tray = new Tray(path.join(__dirname, "./assets/icons/tray-stop.ico"));
  // *.悬浮指针显示的名称
  tray.setToolTip('Data Surveillance');
  // *.托盘菜单及行为设置
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '显示', click: () => {
        if (miniWindow && miniWindow.isVisible()) {
          // *.除非禁用主窗口上调出迷你窗口的功能，否则两个窗口不能同时出现
          miniWindow.destroy();
        }
        mainWindow.show()
      }
    },
    {
      label: '退出', click: () => {
        if (miniWindow) {
          miniWindow.destroy();
        }
        // *.由于 close 事件默认行为被阻止，退出程序只能使用 destroy 事件
        // *.另外 destroy 事件能够保证 closed 事件被执行，以更好地管理内存
        mainWindow.destroy();
      }
    }
  ]));
  tray.on('double-click', () => {
    if (miniWindow && miniWindow.isVisible()) {
      miniWindow.destroy();
    }
    mainWindow.show();
  });

  // *.实现窗口的基本功能，如放大、缩小、关闭窗口等
  // *.方法 ipcMain.on 监听 Electron 窗口事件时，如果存在额外参数，则不能省略 event 入参
  ipcMain.on("minimize-win", () => mainWindow.minimize());
  ipcMain.on('close-win', () => mainWindow.close());
  ipcMain.on('mini-win', () => {
    mainWindow.hide();
    createMiniWindow(zoomFactor);
  });

  /** 监测程序是否处于正在运行中。 */
  let processRun = false;
  /** 监测程序是否处于正在停止中。 */
  let processEnd = false;
  /** 指示程序是否应当继续循环执行。 */
  let monitor = true;

  // *.如果 ipcMain.on 监听事件存在额外参数，则 event 入参不能省略
  ipcMain.on("run-puppeteer", async (event, url, username, passcode) => {
    if (!processRun) {
      processRun = true;
      // *.托盘图标变更为“运行中”状态
      tray.setImage(path.join(__dirname, "./assets/icons/tray-run.ico"));
      // *.只有主动终止程序时 monitor 的值会被改变
      while (monitor) {
        try {
          // *.这里必需添加 await 关键字使异步函数同步执行，否则会立刻进入无限循环
          await start(url, username, passcode, mainWindow);
        } catch (error) {
          // *.被动结束程序依靠抛出带有特定错误信息的错误以终止程序（结束循环）
          if (error.message === "USERNAME-OR-PASSCODE") {
            break;
          } else if (error.message === "NOT-FIND-CHROME") {
            break;
          } else if (error.message === "UKNOW-ISSUE") {
            break;
          }
          // *.其余错误均不会终止程序运行
          if (monitor) {
            // *.执行清理
            await terminate();
            if (monitor) {
              mainWindow.webContents.send(
                "process",
                `${getTime()} ${"[ INFO] main => 清理完毕，程序启动。"}`
              );
            }
            // *.如果 monitor 仍旧为 true 则重新执行程序
          }
        }
      }
      // *.循环结束，复位所有全局变量
      monitor = true;
      processRun = false
      processEnd = false;
      // *.通知以解锁窗体按钮
      mainWindow.webContents.send("control", "The finishing touch.");
      // *.托盘图标变更为“停止中”状态
      tray.setImage(path.join(__dirname, "./assets/icons/tray-stop.ico"));
    }
  });

  ipcMain.on("end-puppeteer", () => {
    if (!processEnd) {
      processEnd = true;
      monitor = false;
      mainWindow.webContents.send(
        "process",
        `${getTime()} ${"[ INFO] main => 尝试发送终止信号。"}`
      );

      // *.与其考虑线程之间的通信，不如将多线程任务转换为单线程任务
      // *.Electron 保持运行状态下 stop() 不会被强行结束，可以不使用 await 关键字
      stop();
    }
  })
};

function createMiniWindow(zoomFactor) {
  const defaultWidth = 81 * zoomFactor;
  const defaultHeight = 185 * zoomFactor;

  miniWindow = new BrowserWindow({
    // *.创建窗口的 width 和 height 参数不支持浮点入参！
    width: Math.ceil(defaultWidth),
    height: Math.ceil(defaultHeight),
    resizable: false,
    maximizable: false,
    frame: false,
    useContentSize: false,
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    alwaysOnTop: true,
  });

  // *.Open the DevTools
  // miniWindow.webContents.openDevTools();

  // *.指示开发环境和生产坏境使用不同位置的 mini.html 主页
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    miniWindow.loadURL(path.join(MAIN_WINDOW_VITE_DEV_SERVER_URL, `${"mini.html"}`));
  } else {
    miniWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/mini.html`));
  }

  // *.指示页面渲染完成并窗口可以被显示时触发
  miniWindow.once("ready-to-show", () => {
    // *.设置窗口初始位置
    const bounds = miniWindow.getBounds();
    // *.初始位置为右下角，距离屏幕边缘 offset 像素宽度
    const offset = 5;
    bounds.x = screen.getPrimaryDisplay().workAreaSize.width - Math.ceil(defaultWidth) - offset;
    bounds.y = screen.getPrimaryDisplay().workAreaSize.height - Math.ceil(defaultHeight) - offset;
    miniWindow.setBounds(bounds);

    // *.显示内容按实际缩放比例呈现
    // *.如果存在 ready-to-show 事件则不建议使用 did-finish-load 事件
    miniWindow.webContents.setZoomFactor(zoomFactor);

    // *.显示窗口
    miniWindow.show();
    // *.不在任务栏上显示 miniWindow 图标
    miniWindow.setSkipTaskbar(true);
  });

  // *.释放内存
  miniWindow.on('closed', () => {
    miniWindow = null;
  });

  miniWindow.hookWindowMessage(WM_INITMENU, () => {
    miniWindow.setEnabled(false);
    miniWindow.setEnabled(true);
  });
}

/**
 * 在 Node.js 的 EventEmitter 实现中（ipcMain 继承自 EventEmitter），同名
 * 事件不会自动覆盖之前的监听器，而是会将新的监听器添加到监听器列表中。
 * 
 * 这意味着每次注册一个新的同名监听器时，都会增加一个新的监听器，这可能会导致
 * 意外的行为或内存泄漏，例如频繁的窗口创建、销毁操作。
 * 
 * 频繁的创建、销毁窗口时，如果伴随着使用 ipcMain.on 创建监听事件，那么同一个
 * 运行时中就会存在多个同名监听器，假如窗口对象为局部变量，且被监听事件所引用，
 * 那么事件再次被调用时，则可能导致灾难性错误。
 * 
 * 建议确保只有一个监听器在处理某个事件，如果一定要创建同名事件，那么建议使用
 * 全局变量来控制 window 对象，或者在注册新的监听器之前移除所有其他同名监听器。
 * 
 * ```
 * ipcMain.removeAllListeners("reset-win");
 * ipcMain.on("reset-win", () => {
 *   miniWindow.destroy();
 *   mainWindow.show();
 * });
 * ```
 */

// *.迷你窗口重置时关闭，主窗口显示
ipcMain.on("reset-win", () => {
  // *.没有监听 close 事件并阻止默认行为的情况下可以选择使用 close() 函数
  // *.只能在 miniWindow 上触发 reset-win 事件
  miniWindow.destroy();
  mainWindow.show();
});

// *.从 Message.vue 接收信息
ipcMain.on("share", (_event, value) => {
  if (miniWindow) {
    // *.将信息发送到 MessageMini.vue 页面
    // *.这里 webContents 会依据调用对象（window 对象）的不同来分发数据
    miniWindow.webContents.send(
      "message",
      `${value}`
    );
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (miniWindow && miniWindow.isVisible()) {
      miniWindow.destroy();
    }
    mainWindow.show();
  }
})
/**
 * This method will be called when Electron has finished
 * initialization and is ready to create browser windows.
 * Some APIs can only be used after this event occurs.
 */
app.whenReady().then(() => {
  createMainWindow();

  /**
   * On OS X it's common to re-create a window in the app when the
   * dock icon is clicked and there are no other windows open.
   */
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

/**
 * Quit when all windows are closed, except on macOS. There, it's common
 * for applications and their menu bar to stay active until the user quits
 * explicitly with Cmd + Q.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * In this file you can include the rest of your app's specific main process
 * code. You can also put them in separate files and import them here.
 */