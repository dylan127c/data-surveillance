<template>
    <div id="message-container">
        <div v-for="(message, index) in messages" :key="index" :class="addColor(message)">
            {{ message }}
        </div>
    </div>
</template>

<script setup>
import { reactive } from 'vue';
const messages = reactive([]);
const maxMessages = 30;

const eleAudio = document.getElementById("hint");

window.correspond.messageReceiver(value => {
    if (messages.length >= maxMessages) {
        messages.shift();
    }
    messages.push(value);

    // *.播放提示音，提示音模块（元素）固定在了 index.html 页面
    if (!new RegExp(": 0").test(value)) {
        const muteStatus = localStorage.getItem("src");
        if (muteStatus !== null && muteStatus.includes("/unmute.png")) {
            eleAudio.play();
        }
    }
    // *.将消息同步到 MessageMini.vue 页面
    window.correspond.messageSender(value);
});

function addColor(message) {
    if (!message.includes(": 0")) {
        return 'fail-red';
    }
    return 'info-green';
}
</script>

<style lang="css">
div#message-container {
    flex-grow: 2.8;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    border-radius: 6px;
    margin: 5px;
    height: 97%;
    box-shadow: 0px 0px 1px 1px #f8f9fe;

    /* 滚动条可以考虑一下需不需要 */
    overflow-x: hidden;
    overflow-y: hidden;

    /* 禁用文本选择 */
    user-select: none;
    -ms-user-select: none;
    -moz-user-select: none;
    -webkit-user-select: none;

    /* 区域允许拖拽 */
    -webkit-app-region: drag;
}

div#message-container div {
    width: 92%;
    font-size: 12px;
    word-wrap: break-word;
    margin-top: 0.2em;
    margin-bottom: 0.2em;
}

div#message-container>div.info-green {
    color: #36bf36;
    font-weight: 700;
}

div#message-container>div.fail-red {
    color: #b22222;
    font-weight: 700;
}
</style>