import { contextBridge, ipcRenderer } from 'electron'
import type { ShellApi, VaultApi } from './preload/types'

const vaultApi: VaultApi = {
  ping: () => ipcRenderer.invoke('app:ping'),
  listEntries: () => ipcRenderer.invoke('vault:listEntries'),
  getEntry: (id) => ipcRenderer.invoke('vault:getEntry', id),
}

const shellApi: ShellApi = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
}

// Only expose the minimal, whitelisted vault surface
contextBridge.exposeInMainWorld('vault', vaultApi)
contextBridge.exposeInMainWorld('shell', shellApi)
