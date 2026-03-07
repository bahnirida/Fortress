"use strict";
const electron = require("electron");
const vaultApi = {
  ping: () => electron.ipcRenderer.invoke("app:ping"),
  createVault: (masterPassword, vaultPath) => electron.ipcRenderer.invoke("vault:create", masterPassword, vaultPath),
  openVault: (masterPassword, vaultPath) => electron.ipcRenderer.invoke("vault:open", masterPassword, vaultPath),
  lockVault: () => electron.ipcRenderer.invoke("vault:lock"),
  isUnlocked: () => electron.ipcRenderer.invoke("vault:isUnlocked"),
  changeMasterPassword: (oldPassword, newPassword) => electron.ipcRenderer.invoke("vault:changeMasterPassword", oldPassword, newPassword),
  exportEncryptedVault: (copyToPath) => electron.ipcRenderer.invoke("vault:exportEncryptedVault", copyToPath),
  getAutoLockMinutes: () => electron.ipcRenderer.invoke("vault:getAutoLockMinutes"),
  setAutoLockMinutes: (minutes) => electron.ipcRenderer.invoke("vault:setAutoLockMinutes", minutes),
  touchActivity: () => electron.ipcRenderer.invoke("vault:touchActivity"),
  listItems: (query) => electron.ipcRenderer.invoke("vault:listItems", query),
  getItem: (id) => electron.ipcRenderer.invoke("vault:getItem", id),
  createItem: (payload) => electron.ipcRenderer.invoke("vault:createItem", payload),
  updateItem: (id, payload) => electron.ipcRenderer.invoke("vault:updateItem", id, payload),
  deleteItem: (id) => electron.ipcRenderer.invoke("vault:deleteItem", id),
  listTags: () => electron.ipcRenderer.invoke("vault:listTags"),
  createTag: (name) => electron.ipcRenderer.invoke("vault:createTag", name),
  deleteTag: (id) => electron.ipcRenderer.invoke("vault:deleteTag", id),
  setItemTags: (itemId, tagIds) => electron.ipcRenderer.invoke("vault:setItemTags", itemId, tagIds),
  onStateChanged: (listener) => {
    const handler = (_event, state) => listener(state);
    electron.ipcRenderer.on("vault:stateChanged", handler);
    return () => electron.ipcRenderer.removeListener("vault:stateChanged", handler);
  }
};
const shellApi = {
  minimize: () => electron.ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => electron.ipcRenderer.invoke("window:toggleMaximize"),
  close: () => electron.ipcRenderer.invoke("window:close"),
  isMaximized: () => electron.ipcRenderer.invoke("window:isMaximized"),
  reload: () => electron.ipcRenderer.invoke("app:reload"),
  toggleDevTools: () => electron.ipcRenderer.invoke("app:toggleDevTools"),
  zoomIn: () => electron.ipcRenderer.invoke("app:zoomIn"),
  zoomOut: () => electron.ipcRenderer.invoke("app:zoomOut"),
  zoomReset: () => electron.ipcRenderer.invoke("app:zoomReset"),
  copyText: (text) => electron.ipcRenderer.invoke("app:copyText", text),
  copySecret: (text, clearAfterMs) => electron.ipcRenderer.invoke("app:copySecret", text, clearAfterMs),
  openImportDialog: () => electron.ipcRenderer.invoke("file:import"),
  openExportDialog: () => electron.ipcRenderer.invoke("file:export")
};
electron.contextBridge.exposeInMainWorld("vault", vaultApi);
electron.contextBridge.exposeInMainWorld("shell", shellApi);
