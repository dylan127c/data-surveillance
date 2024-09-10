/**
 * 出于安全性考虑，Vue 中不允许直接使用 Electron 相关的 API，如 ipcRenderer 等。
 * 这里的 preload.js 充当了 Electron 和 Vue 之间的通信桥梁。
 * 
 * Vue 中可以访问 Electron 环境内的 window 全局对象，使用该对象可以建立他们之间的通讯：
 * 
 * - Vue => Electron: 
 *      - window.apiKey.api(..) => ipcRenderer.send(..) => ipcMain.on(..)
 * - Electron => Vue:
 *      - window.webContents.send(..) => ipcRendere.on(..) => window.apiKey.api(..)
 */
const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("correspond", {
    // *.Vue => Electron | window.apiKey.api => ipcMain.on
    close: () => ipcRenderer.send("close-win"),
    minimize: () => ipcRenderer.send("minimize-win"),
    mini: () => ipcRenderer.send("mini-win"),
    start: (url, username, passcode) => ipcRenderer.send("run-puppeteer", url, username, passcode),
    stop: () => ipcRenderer.send("end-puppeteer"),
    reset: () => ipcRenderer.send("reset-win"),
    messageSender: (value) => ipcRenderer.send("share", value),

    // *.Electron => Vue | window.webContents.send => windows.apiKey.api
    processReceiver: (callback) => ipcRenderer.on("process", (_event, value) => callback(value)),
    messageReceiver: (callback) => ipcRenderer.on("message", (_event, value) => callback(value)),
    optionsReceiver: (callback) => ipcRenderer.on("options", (_event, value) => callback(value)),
    controlReceiver: (callback) => ipcRenderer.on("control", (_event, value) => callback(value)),
});