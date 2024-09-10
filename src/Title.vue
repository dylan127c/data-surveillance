<template>
    <div id="title-container">
        <span id="titlebar">
            <img src="/src/assets/icons/favicon.ico" alt="favicon">
            <span id="title">{{ title }}</span>
        </span>
        <span id="volume" @click="volume">
            <img :src="src" alt="volume" draggable="false">
        </span>
        <span id="mini" @click="mini">
            <img src="/src/assets/icons/mini.png" alt="mini" draggable="false">
        </span>
        <span id="minimize" @click="minimize">
            <img src="/src/assets/icons/minimize.png" alt="minimize" draggable="false">
        </span>
        <span id="close" @click="close">
            <img src="/src/assets/icons/close.png" alt="close" draggable="false">
        </span>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const title = ref(" Data Surveillance");

// *.缓存可能会导致图片按钮存在假象，不过实际按钮的功能不受影响

// *.produce path
const mute = ref("../../build/assets/icons/mute.png");
const unmute = ref("../../build/assets/icons/unmute.png");

// *.develop path
// const mute = ref("/src/assets/icons/mute.png");
// const unmute = ref("/src/assets/icons/unmute.png");

const src = ref(localStorage.getItem("src") || mute.value);

function volume() {
    if (src.value.includes("unmute")) {
        src.value = mute.value;
    } else {
        src.value = unmute.value;
    }
    localStorage.setItem("src", src.value);
}
function mini() {
    window.correspond.mini();
}
function minimize() {
    window.correspond.minimize();
}
function close() {
    window.correspond.close();
}
</script>

<style lang="css">
div#title-container {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    height: 32px;
    box-shadow: 0px 0px 1px 1px #f8f9fe;
    border-radius: 6px;
    margin-top: 12px;
    margin-left: 5px;
    margin-right: 5px;

    /* 禁用文本选择（有时候会不小心选中图标图片等元素）*/
    user-select: none;
    -ms-user-select: none;
    -moz-user-select: none;
    -webkit-user-select: none;
}

div#title-container>span {
    flex-basis: 10px;
    border-radius: inherit;
    margin-left: 5px;
    margin-right: 5px;
}

div#title-container span#titlebar {
    flex-grow: 30;
    display: flex;
    justify-content: start;
    align-items: center;
    line-height: 40px;
    vertical-align: middle;
    -webkit-app-region: drag;
}

div#title-container span#title {
    font-size: 14px;
    margin-left: 5px;
}

div#title-container span#volume,
div#title-container span#mini,
div#title-container span#minimize,
div#title-container span#close {
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 2px;
    margin-bottom: 2px;
}

div#title-container span#volume:hover,
div#title-container span#mini:hover,
div#title-container span#minimize:hover,
div#title-container span#close:hover {
    background-color: #f8f9fe;
}

div#title-container span#volume img,
div#title-container span#mini img,
div#title-container span#minimize img,
div#title-container span#close img {
    border-radius: 12px;
    width: 20px;
    height: 20px;
}

div#title-container span#titlebar img {
    width: 20px;
    height: 20px;
}
</style>