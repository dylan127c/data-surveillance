<template>
    <div id="process-container" ref="processContainer">
        <div v-for="(message, index) in messages" :key="index" :class="addColor(message)">
            {{ message }}
        </div>
    </div>
</template>

<script setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue';
const messages = reactive([]);
const maxMessages = 50;
const processContainer = ref(null);

window.correspond.processReceiver(value => {
    if (messages.length >= maxMessages) {
        messages.shift();
    }
    messages.push(value);
});

onMounted(() => {
    // *.初始滚动到最底部
    scrollToBottom();
});

watch(messages, () => {
    // *.当 messages 数组发生变化时，滚动到最底部
    scrollToBottom();
});

function scrollToBottom() {
    nextTick(() => {
        const container = processContainer.value;
        container.scrollTop = container.scrollHeight;
    });
}

function addColor(message) {
    if (message.includes("INFO")) {
        return 'info-green';
    }
    if (message.includes('FAIL') || message.includes('Type')) {
        return 'fail-red';
    }
    if (message.includes('START')) {
        return 'start-yellow'
    }
    return 'stop-blue';
}
</script>

<style lang="css">
div#process-container {
    flex-grow: 1.9;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    border-radius: 6px;
    box-shadow: 0px 0px 1px 1px #f8f9fe;

    /* 同级 flex 元素固定，那么此样式行为的表现将相反 */
    margin: 5px;
    padding-bottom: 2px;

    /* 滚动条可以考虑一下需不需要 */
    overflow-x: hidden;
    overflow-y: scroll;

    /* 禁用文本选择 */
    user-select: none;
    -ms-user-select: none;
    -moz-user-select: none;
    -webkit-user-select: none;
}

div#process-container>div {
    width: 96%;
    font-size: 12px;
    word-wrap: break-word;
    margin-top: 0.2em;
    margin-bottom: 0.2em;
}

div#process-container>div.info-green {
    color: #36bf36;
    font-weight: 700;
}

div#process-container>div.fail-red {
    color: #b22222;
    font-weight: 700;
}

div#process-container>div.start-yellow {
    color: #ffc107;
    font-weight: 700;
}

div#process-container>div.stop-blue {
    color: #24367d;
    font-weight: 700;
}
</style>