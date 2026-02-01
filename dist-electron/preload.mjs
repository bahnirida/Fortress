"use strict";
const electron = require("electron");
const vaultApi = {
  ping: () => electron.ipcRenderer.invoke("app:ping"),
  listEntries: () => electron.ipcRenderer.invoke("vault:listEntries"),
  getEntry: (id) => electron.ipcRenderer.invoke("vault:getEntry", id)
};
const shellApi = {
  minimize: () => electron.ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => electron.ipcRenderer.invoke("window:toggleMaximize"),
  close: () => electron.ipcRenderer.invoke("window:close"),
  isMaximized: () => electron.ipcRenderer.invoke("window:isMaximized")
};
electron.contextBridge.exposeInMainWorld("vault", vaultApi);
electron.contextBridge.exposeInMainWorld("shell", shellApi);
