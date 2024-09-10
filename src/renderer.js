/**
 * 默认情况下，Electron 不允许在 renderer.js 中使用 Node.js 的 API，如 fs、path 等。
 * 
 * 在 main.js 中启用 nodeIntegration 可以解除这一限制：
 * 
 * ```
 *  // *.Create the browser window
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 * 
 * 在 renderer.js 中能够直接使用 DOM 来操作 index.html 中的内容，类似 .vue。
 */

// *.通用样式文件，HTML 引用 renderer.sj 时会自动应用此样式
import './index.css';

// *.不过 renderer.js 主要目的是挂载 Vue 组件到 index.html 页面
import { createApp } from 'vue';
import Title from './Title.vue';
import App from './App.vue';

createApp(Title).mount("#title");
createApp(App).mount("#app");