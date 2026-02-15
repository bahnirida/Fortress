import { BrowserWindow, app, clipboard, dialog } from 'electron'
import type { IpcMain, OpenDialogOptions, SaveDialogOptions } from 'electron'
import { vaultService } from '../main/vaultService'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1
const DEFAULT_CLIPBOARD_CLEAR_MS = 30_000

const clampZoom = (value: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unexpected error'
}

type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function fail(code: string, error: unknown): IpcResult<never> {
  return {
    ok: false,
    error: {
      code,
      message: toErrorMessage(error),
    },
  }
}

function notifyVaultState(unlocked: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('vault:stateChanged', { unlocked })
  }
}

function clearClipboardAfterDelay(snapshot: string, clearAfterMs: number): void {
  setTimeout(() => {
    if (clipboard.readText() === snapshot) {
      clipboard.clear()
    }
  }, clearAfterMs)
}

export function registerIpcHandlers(ipcMain: IpcMain): void {
  vaultService.on('locked', () => notifyVaultState(false))
  vaultService.on('unlocked', () => notifyVaultState(true))

  ipcMain.handle('app:ping', async () => 'pong')

  ipcMain.handle('vault:create', async (_event, masterPassword: string, vaultPath?: string) => {
    try {
      const targetPath = vaultPath?.trim() || `${app.getPath('userData')}\\vault.db`
      vaultService.createVault(masterPassword, targetPath)
      return ok({ unlocked: true, vaultPath: vaultService.getVaultPath() })
    } catch (error) {
      return fail('VAULT_CREATE_FAILED', error)
    }
  })

  ipcMain.handle('vault:open', async (_event, masterPassword: string, vaultPath: string) => {
    try {
      vaultService.openVault(masterPassword, vaultPath)
      return ok({ unlocked: true, vaultPath: vaultService.getVaultPath() })
    } catch (error) {
      return fail('VAULT_OPEN_FAILED', error)
    }
  })

  ipcMain.handle('vault:lock', async () => {
    vaultService.lockVault()
    return { unlocked: false }
  })

  ipcMain.handle('vault:isUnlocked', async () => {
    return vaultService.isUnlocked()
  })

  ipcMain.handle('vault:changeMasterPassword', async (_event, oldPassword: string, newPassword: string) => {
    try {
      vaultService.changeMasterPassword(oldPassword, newPassword)
      return true
    } catch (error) {
      throw new Error(toErrorMessage(error))
    }
  })

  ipcMain.handle('vault:exportEncryptedVault', async (_event, copyToPath: string) => {
    try {
      vaultService.exportEncryptedVault(copyToPath)
      return true
    } catch (error) {
      throw new Error(toErrorMessage(error))
    }
  })

  ipcMain.handle('vault:getAutoLockMinutes', async () => vaultService.getAutoLockMinutes())

  ipcMain.handle('vault:setAutoLockMinutes', async (_event, minutes: number) => {
    return vaultService.setAutoLockMinutes(minutes)
  })

  ipcMain.handle('vault:touchActivity', async () => {
    vaultService.touchActivity()
    return true
  })

  ipcMain.handle('vault:listItems', async (_event, query?: string) => {
    return vaultService.listItems(query)
  })

  ipcMain.handle('vault:getItem', async (_event, id: string) => {
    return vaultService.getItem(id)
  })

  ipcMain.handle('vault:createItem', async (_event, payload) => {
    return vaultService.createItem(payload)
  })

  ipcMain.handle('vault:updateItem', async (_event, id: string, payload) => {
    return vaultService.updateItem(id, payload)
  })

  ipcMain.handle('vault:deleteItem', async (_event, id: string) => {
    vaultService.deleteItem(id)
    return true
  })

  ipcMain.handle('vault:listTags', async () => vaultService.listTags())

  ipcMain.handle('vault:createTag', async (_event, name: string) => {
    return vaultService.createTag(name)
  })

  ipcMain.handle('vault:deleteTag', async (_event, id: string) => {
    vaultService.deleteTag(id)
    return true
  })

  ipcMain.handle('vault:setItemTags', async (_event, itemId: string, tagIds: string[]) => {
    vaultService.setItemTags(itemId, tagIds)
    return true
  })

  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  ipcMain.handle('window:toggleMaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
      return false
    }
    win.maximize()
    return true
  })

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.handle('app:reload', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.reload()
  })

  ipcMain.handle('app:toggleDevTools', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const wc = win?.webContents
    if (!wc) return false
    if (wc.isDevToolsOpened()) {
      wc.closeDevTools()
      return false
    }
    wc.openDevTools({ mode: 'detach' })
    return true
  })

  ipcMain.handle('app:zoomIn', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const wc = win?.webContents
    if (!wc) return 1
    const next = clampZoom(wc.getZoomFactor() + ZOOM_STEP)
    wc.setZoomFactor(next)
    return next
  })

  ipcMain.handle('app:zoomOut', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const wc = win?.webContents
    if (!wc) return 1
    const next = clampZoom(wc.getZoomFactor() - ZOOM_STEP)
    wc.setZoomFactor(next)
    return next
  })

  ipcMain.handle('app:zoomReset', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const wc = win?.webContents
    if (!wc) return 1
    wc.setZoomFactor(1)
    return 1
  })

  ipcMain.handle('app:copyText', async (_event, text: string) => {
    clipboard.writeText(text ?? '')
    return true
  })

  ipcMain.handle('app:copySecret', async (_event, text: string, clearAfterMs?: number) => {
    const value = text ?? ''
    clipboard.writeText(value)
    clearClipboardAfterDelay(value, clearAfterMs ?? DEFAULT_CLIPBOARD_CLEAR_MS)
    return true
  })

  ipcMain.handle('file:import', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const dialogOptions: OpenDialogOptions = {
      title: 'Open Vault',
      properties: ['openFile'],
      filters: [
        { name: 'Encrypted Vault', extensions: ['db', 'sqlite', 'vault'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    }
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('file:export', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const dialogOptions: SaveDialogOptions = {
      title: 'Export Encrypted Vault Copy',
      defaultPath: 'vault-export.db',
      filters: [
        { name: 'Encrypted Vault', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    }
    const result = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions)
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })
}
