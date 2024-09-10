<script setup>
import Message from './components/Message.vue';
import Process from './components/Process.vue';
import Options from './components/Options.vue';
</script>

<!-- 
    进行 Vue 布局设计时，就应当把所有的网页元素布局在 App.vue 文件中，即开始
    就应该把 Title.vue 纳入 App.vue 中，并只在 index.html 中引入 App.vue。

    如果一开始就将 Title.vue 纳入，即可通过 Title.vue 上的元素来控制整个页面
    元素的显示/隐藏。
-->

<template>
    <div id="app-container">
        <Message />
        <div id="second-layer">
            <Process />
            <Options />
        </div>
    </div>
</template>

<style lang="css">
div#app-container {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    height: 537px;
    border-radius: 6px;
    margin-top: 10px;
}

div#app-container>* {
    flex-basis: 50px;
}

div#second-layer {
    flex-grow: 8;
    display: flex;
    flex-direction: column;
    border-radius: 6px;
    margin: 5px;
    height: 97%;
    box-shadow: 0px 0px 1px 1px #f8f9fe;
}

div#second-layer>* {
    flex-basis: 50px;
}
</style>