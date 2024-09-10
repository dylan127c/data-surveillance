// *.index.html 引用 renderer.js 文件
// *.mini.html 引用 mini.js 文件

import './index.css';
import { createApp } from 'vue';
import TitleMini from './TitleMini.vue';
import Message from './components/MessageMini.vue';

createApp(TitleMini).mount("#title");
createApp(Message).mount("#message");