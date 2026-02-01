import { BrowserWindow, app, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
const MOCK_ENTRIES = [
  {
    id: "1",
    type: "password",
    title: "GitHub",
    username: "rida.bahni",
    url: "https://github.com",
    favorite: true,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "2",
    type: "note",
    title: "Recovery Codes",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
function registerIpcHandlers(ipcMain2) {
  ipcMain2.handle("app:ping", async () => "pong");
  ipcMain2.handle("vault:listEntries", async () => {
    return MOCK_ENTRIES;
  });
  ipcMain2.handle("vault:getEntry", async (_evt, id) => {
    return MOCK_ENTRIES.find((e) => e.id === id) ?? null;
  });
  ipcMain2.handle("window:minimize", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    win2 == null ? void 0 : win2.minimize();
  });
  ipcMain2.handle("window:maximize", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    win2 == null ? void 0 : win2.maximize();
  });
  ipcMain2.handle("window:restore", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    win2 == null ? void 0 : win2.restore();
  });
  ipcMain2.handle("window:isMaximized", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    return (win2 == null ? void 0 : win2.isMaximized()) ?? false;
  });
  ipcMain2.handle("window:toggleMaximize", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    if (!win2) return false;
    if (win2.isMaximized()) {
      win2.unmaximize();
      return false;
    }
    win2.maximize();
    return true;
  });
  ipcMain2.handle("window:close", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    win2 == null ? void 0 : win2.close();
  });
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      // Security-first defaults for a password manager UI
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      enableRemoteModule: false,
      preload: path.join(__dirname$1, "preload.mjs")
    },
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0b0d12",
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: process.platform === "darwin" ? { x: 12, y: 14 } : void 0
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  registerIpcHandlers(ipcMain);
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
