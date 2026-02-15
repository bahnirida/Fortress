import { contextBridge, ipcRenderer } from 'electron'
import type { ShellApi, VaultApi } from './preload/types'

const vaultApi: VaultApi = {
  ping: () => ipcRenderer.invoke('app:ping'),
  createVault: (masterPassword, vaultPath) => ipcRenderer.invoke('vault:create', masterPassword, vaultPath),
  openVault: (masterPassword, vaultPath) => ipcRenderer.invoke('vault:open', masterPassword, vaultPath),
  lockVault: () => ipcRenderer.invoke('vault:lock'),
  isUnlocked: () => ipcRenderer.invoke('vault:isUnlocked'),
  changeMasterPassword: (oldPassword, newPassword) =>
    ipcRenderer.invoke('vault:changeMasterPassword', oldPassword, newPassword),
  exportEncryptedVault: (copyToPath) => ipcRenderer.invoke('vault:exportEncryptedVault', copyToPath),
  getAutoLockMinutes: () => ipcRenderer.invoke('vault:getAutoLockMinutes'),
  setAutoLockMinutes: (minutes) => ipcRenderer.invoke('vault:setAutoLockMinutes', minutes),
  touchActivity: () => ipcRenderer.invoke('vault:touchActivity'),
  listItems: (query) => ipcRenderer.invoke('vault:listItems', query),
  getItem: (id) => ipcRenderer.invoke('vault:getItem', id),
  createItem: (payload) => ipcRenderer.invoke('vault:createItem', payload),
  updateItem: (id, payload) => ipcRenderer.invoke('vault:updateItem', id, payload),
  deleteItem: (id) => ipcRenderer.invoke('vault:deleteItem', id),
  listTags: () => ipcRenderer.invoke('vault:listTags'),
  createTag: (name) => ipcRenderer.invoke('vault:createTag', name),
  deleteTag: (id) => ipcRenderer.invoke('vault:deleteTag', id),
  setItemTags: (itemId, tagIds) => ipcRenderer.invoke('vault:setItemTags', itemId, tagIds),
  onStateChanged: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: { unlocked: boolean }) => listener(state)
    ipcRenderer.on('vault:stateChanged', handler)
    return () => ipcRenderer.removeListener('vault:stateChanged', handler)
  },
}

const shellApi: ShellApi = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  reload: () => ipcRenderer.invoke('app:reload'),
  toggleDevTools: () => ipcRenderer.invoke('app:toggleDevTools'),
  zoomIn: () => ipcRenderer.invoke('app:zoomIn'),
  zoomOut: () => ipcRenderer.invoke('app:zoomOut'),
  zoomReset: () => ipcRenderer.invoke('app:zoomReset'),
  copyText: (text) => ipcRenderer.invoke('app:copyText', text),
  copySecret: (text, clearAfterMs) => ipcRenderer.invoke('app:copySecret', text, clearAfterMs),
  openImportDialog: () => ipcRenderer.invoke('file:import'),
  openExportDialog: () => ipcRenderer.invoke('file:export'),
}

contextBridge.exposeInMainWorld('vault', vaultApi)
contextBridge.exposeInMainWorld('shell', shellApi)
