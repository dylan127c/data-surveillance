<template>
    <div id="title-container">
        <span id="reset" @click="reset">
            <img src="/src/assets/icons/reset.png" alt="reset" draggable="false">
        </span>
    </div>
</template>

<script setup>
function reset() {
    window.correspond.reset();
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

div#title-container span#reset {
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 2px;
    margin-bottom: 2px;
}

div#title-container span#reset:hover {
    background-color: #f8f9fe;
}

div#title-container span#reset img {
    border-radius: 12px;
    width: 20px;
    height: 20px;
}
</style>