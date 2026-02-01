import { BrowserWindow } from 'electron';
import type { IpcMain } from 'electron';
import type { VaultEntry } from '../preload/types';

const MOCK_ENTRIES: VaultEntry[] = [
    {
        id: '1',
        type: 'password',
        title: 'GitHub',
        username: 'rida.bahni',
        url: 'https://github.com',
        favorite: true,
        updatedAt: new Date().toISOString(),
    },
    {
        id: '2',
        type: 'note',
        title: 'Recovery Codes',
        updatedAt: new Date().toISOString(),
    },
];

export function registerIpcHandlers(ipcMain: IpcMain) {
    ipcMain.handle('app:ping', async () => 'pong');

    ipcMain.handle('vault:listEntries', async () => {
        return MOCK_ENTRIES;
    });

    ipcMain.handle('vault:getEntry', async (_evt, id: string) => {
        return MOCK_ENTRIES.find((e) => e.id === id) ?? null;
    });

    ipcMain.handle('window:minimize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win?.minimize();
    });

    ipcMain.handle('window:maximize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win?.maximize();
    });

    ipcMain.handle('window:restore', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win?.restore();
    });

    ipcMain.handle('window:isMaximized', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return win?.isMaximized() ?? false;
    });

    ipcMain.handle('window:toggleMaximize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return false;
        if (win.isMaximized()) {
            win.unmaximize();
            return false;
        }
        win.maximize();
        return true;
    });

    ipcMain.handle('window:close', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win?.close();
    });
}
