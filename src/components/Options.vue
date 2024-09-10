<template>
    <div id="option-container">
        <div id="url">
            <label>目标网址：</label>
            <select v-model="selectedURL" :disabled="isEntryDisabled">
                <option :value="url.a">{{ url.a }}</option>
                <option :value="url.b">{{ url.b }}</option>
                <option :value="url.c">{{ url.c }}</option>
            </select>
        </div>
        <div id="info">
            <div id="logon">
                <div>
                    <label>用户名称：</label>
                    <input :disabled="isEntryDisabled" placeholder="E.g. layden" v-model="username"
                        :style="{ 'pointer-events': pointerEvents }" />
                </div>
                <div>
                    <label>登录密码：</label>
                    <input :disabled="isEntryDisabled" placeholder="E.g. passcode" v-model="passcode"
                        :style="{ 'pointer-events': pointerEvents }" />
                </div>
            </div>
            <div id="button">
                <div><button @click="toggleSetupProcess" :disabled="isSetupDisabled"
                        :style="{ backgroundColor: btnSetActiveColor }"
                        @mouseover="btnSetActiveColor = btnSetHoverColor"
                        @mouseleave="btnSetActiveColor = btnSetSaveColor">{{ showSet }}</button></div>
                <div><button @click="toggleStartProcess" :disabled="isStartDisabled"
                        :style="{ backgroundColor: btnRunActiveColor }"
                        @mouseover="btnRunActiveColor = btnRunHoverColor"
                        @mouseleave="btnRunActiveColor = btnRunSaveColor">{{ showRun }}</button></div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const url = ref({
    a: import.meta.env.VITE_URL_A,
    b: import.meta.env.VITE_URL_B,
    c: import.meta.env.VITE_URL_C
});

const selectedURL = ref(localStorage.getItem("url") || url.value.a);
const username = ref(localStorage.getItem("username") || "");
const passcode = ref(localStorage.getItem("passcode") || "");

const pointerEvents = ref("none");

// *.Vue 实现 hover 效果
const warnColor = "#d42020";
const hoverWarnColor = "#cd2d22";
const infoColor = "#299134";
const hoverInfoColor = "#458447";

const btnSetActiveColor = ref("");
const btnSetSaveColor = ref("");
const btnSetHoverColor = ref("");
const btnRunActiveColor = ref("");
const btnRunSaveColor = ref("");
const btnRunHoverColor = ref("");

const showSet = ref("配置");
const showRun = ref("开始");

const isEntryDisabled = ref(true);
const isSetupDisabled = ref(false);
const isStartDisabled = ref(false);

function toggleSetupProcess() {
    if (isEntryDisabled.value) {
        btnSetActiveColor.value = hoverWarnColor;
        btnSetSaveColor.value = warnColor;
        btnSetHoverColor.value = hoverWarnColor;

        pointerEvents.value = "auto";
        showSet.value = "锁定";
    } else {
        btnSetActiveColor.value = "";
        btnSetHoverColor.value = "";
        btnSetSaveColor.value = "";

        pointerEvents.value = "none";
        showSet.value = "配置";

        localStorage.setItem("url", selectedURL.value);
        localStorage.setItem("username", username.value);
        localStorage.setItem("passcode", passcode.value);
    }
    isEntryDisabled.value = !isEntryDisabled.value;
    isStartDisabled.value = !isStartDisabled.value;
}

function toggleStartProcess() {
    if (!isSetupDisabled.value) {
        btnRunActiveColor.value = hoverInfoColor;
        btnRunSaveColor.value = infoColor;
        btnRunHoverColor.value = hoverInfoColor;

        showRun.value = "停止";
        window.correspond.start(selectedURL.value, username.value, passcode.value);
        isSetupDisabled.value = !isSetupDisabled.value;
    } else {
        stopLogic();
        // *.主动终止，需通知 main.js 执行终止程序
        window.correspond.stop();
    }
}

// *.非主动调用 sniff.terminate 的情况也应该 disable 所有的按钮
// *.此监听器会监听被动终止程序的信息，以禁用所有相关按钮，避免用户误操作
window.correspond.optionsReceiver(value => {
    if (value === "dylan127c") {
        // *.意外中止，程序将自动执行终止过程
        stopLogic();
    }
});

function stopLogic() {
    btnRunActiveColor.value = "";
    btnRunHoverColor.value = "";
    btnRunSaveColor.value = "";

    isStartDisabled.value = !isStartDisabled.value;
}

// *.监听终止过程是否完整结束
window.correspond.controlReceiver(value => {
    if (value === "The finishing touch.") {
        showRun.value = "开始";

        // *.除了手动终止之外，还有其他被动异常能够终止程序运行
        // *.即便是非主动终止，设置或开始按钮也要保持可用的状态
        isSetupDisabled.value = false;
        isStartDisabled.value = false;
    }
});
</script>

<style lang="css">
div#option-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    border-radius: 6px;
    margin: 5px;
    box-shadow: 0px 0px 1px 1px #f8f9fe;

    /* 禁用文本选择 */
    user-select: none;
    -ms-user-select: none;
    -moz-user-select: none;
    -webkit-user-select: none;
}

div#option-container>div {
    flex-basis: 10px;
}

div#option-container div#url {
    flex-grow: 1;
    width: 96%;
    display: flex;
    align-items: center;
    border-radius: 6px;
    margin: 5px;
    box-shadow: 0px 0px 1px 1px #f8f9fe;
}

div#option-container div#info {
    flex-grow: 2;
    width: 96%;
    display: flex;
    border-radius: 6px;
    margin: 5px;
    box-shadow: 0px 0px 1px 1px #f8f9fe;
}

div#info>div {
    flex-basis: 10px;
}

div#info div#logon {
    flex-grow: 3;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    align-items: flex-start;
    border-radius: 6px;
    margin: 5px 0;
}

div#info div#button {
    flex-grow: 2;
    display: flex;
    flex-direction: row;
    justify-content: space-evenly;
    align-items: center;
    border-radius: 6px;
    margin: 5px;
    box-shadow: 0px 0px 1px 1px #f8f9fe;
}

div#logon>div {
    display: flex;
    align-items: center;
}
</style>