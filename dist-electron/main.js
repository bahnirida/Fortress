var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const SCHEMA_VERSION = 1;
function migrationV1(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      username TEXT,
      password TEXT,
      url TEXT,
      notes TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS item_tags (
      itemId TEXT NOT NULL,
      tagId TEXT NOT NULL,
      PRIMARY KEY (itemId, tagId),
      FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
    CREATE INDEX IF NOT EXISTS idx_items_url ON items(url);
    CREATE INDEX IF NOT EXISTS idx_items_username ON items(username);
  `);
}
function runMigrations(db) {
  const currentVersionRow = db.prepare("PRAGMA user_version;").get();
  const currentVersion = Number(currentVersionRow.user_version ?? 0);
  if (currentVersion > SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version ${currentVersion}. App supports up to ${SCHEMA_VERSION}.`);
  }
  if (currentVersion < 1) {
    migrationV1(db);
    db.prepare("PRAGMA user_version = 1;").run();
  }
}
const require$1 = createRequire(import.meta.url);
const Database = require$1("better-sqlite3");
const DEFAULT_KDF_ITER = 256e3;
const DEFAULT_AUTO_LOCK_MINUTES = 10;
const MIN_AUTO_LOCK_MINUTES = 1;
const MAX_AUTO_LOCK_MINUTES = 240;
function escapePragmaString(value) {
  return value.replace(/'/g, "''");
}
function sanitizeNullableText(value) {
  if (value === void 0 || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function sanitizeName(value) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Item name is required.");
  }
  return normalized;
}
function escapeLikeTerm(value) {
  return value.replace(/([%_\\])/g, "\\$1");
}
function normalizeAutoLockMinutes(value) {
  if (!Number.isFinite(value)) return DEFAULT_AUTO_LOCK_MINUTES;
  return Math.min(MAX_AUTO_LOCK_MINUTES, Math.max(MIN_AUTO_LOCK_MINUTES, Math.floor(value)));
}
class VaultService extends EventEmitter {
  constructor(options) {
    super();
    __publicField(this, "db", null);
    __publicField(this, "vaultPath", null);
    __publicField(this, "kdfIter");
    __publicField(this, "autoLockMinutes");
    __publicField(this, "lastActivityAt", Date.now());
    __publicField(this, "autoLockTimer", null);
    this.kdfIter = (options == null ? void 0 : options.kdfIter) ?? DEFAULT_KDF_ITER;
    this.autoLockMinutes = normalizeAutoLockMinutes((options == null ? void 0 : options.autoLockMinutes) ?? DEFAULT_AUTO_LOCK_MINUTES);
  }
  on(event, listener) {
    return super.on(event, listener);
  }
  emit(event) {
    return super.emit(event);
  }
  createVault(masterPassword, rawVaultPath) {
    if (!masterPassword) {
      throw new Error("Master password is required.");
    }
    const resolvedPath = path.resolve(rawVaultPath);
    const parentDir = path.dirname(resolvedPath);
    fs.mkdirSync(parentDir, { recursive: true });
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).size > 0) {
      throw new Error("Vault file already exists and is not empty.");
    }
    this.disconnect(false);
    const db = new Database(resolvedPath);
    try {
      this.applySqlcipherKeyAndPragmas(db, masterPassword);
      runMigrations(db);
      this.verifyUnlock(db);
      this.db = db;
      this.vaultPath = resolvedPath;
      this.touchActivity();
      this.emit("unlocked");
    } catch (error) {
      db.close();
      throw error;
    }
  }
  openVault(masterPassword, rawVaultPath) {
    if (!masterPassword) {
      throw new Error("Master password is required.");
    }
    const resolvedPath = path.resolve(rawVaultPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error("Vault file was not found.");
    }
    this.disconnect(false);
    const db = new Database(resolvedPath);
    try {
      this.applySqlcipherKeyAndPragmas(db, masterPassword);
      this.verifyUnlock(db);
      runMigrations(db);
      this.db = db;
      this.vaultPath = resolvedPath;
      this.touchActivity();
      this.emit("unlocked");
    } catch {
      db.close();
      throw new Error("Unable to unlock vault. Check password or file integrity.");
    }
  }
  lockVault() {
    this.disconnect(true);
  }
  isUnlocked() {
    return this.db !== null;
  }
  getVaultPath() {
    return this.vaultPath;
  }
  changeMasterPassword(oldPassword, newPassword) {
    if (!oldPassword || !newPassword) {
      throw new Error("Both old and new master passwords are required.");
    }
    const db = this.requireDb();
    const currentPath = this.requireVaultPath();
    const probe = new Database(currentPath, { readonly: true });
    try {
      this.applySqlcipherKeyAndPragmas(probe, oldPassword);
      this.verifyUnlock(probe);
    } catch {
      throw new Error("Old master password is incorrect.");
    } finally {
      probe.close();
    }
    const escapedNew = escapePragmaString(newPassword);
    db.exec(`PRAGMA rekey = '${escapedNew}';`);
    this.touchActivity();
  }
  exportEncryptedVault(copyToPath) {
    const sourcePath = this.requireVaultPath();
    if (!this.isUnlocked()) {
      throw new Error("Vault must be unlocked before export.");
    }
    const resolvedDestination = path.resolve(copyToPath);
    fs.mkdirSync(path.dirname(resolvedDestination), { recursive: true });
    fs.copyFileSync(sourcePath, resolvedDestination);
  }
  setAutoLockMinutes(minutes) {
    this.autoLockMinutes = normalizeAutoLockMinutes(minutes);
    this.scheduleAutoLock();
    return this.autoLockMinutes;
  }
  getAutoLockMinutes() {
    return this.autoLockMinutes;
  }
  touchActivity() {
    if (!this.isUnlocked()) return;
    this.lastActivityAt = Date.now();
    this.scheduleAutoLock();
  }
  listItems(query) {
    const db = this.requireDb();
    this.touchActivity();
    const normalizedQuery = query == null ? void 0 : query.trim();
    const rows = normalizedQuery ? db.prepare(
      `
            SELECT id, type, name, username, NULL as password, url, NULL as notes, createdAt, updatedAt
            FROM items
            WHERE name LIKE ? ESCAPE '\\'
               OR url LIKE ? ESCAPE '\\'
               OR username LIKE ? ESCAPE '\\'
            ORDER BY updatedAt DESC;
          `
    ).all(...this.searchParams(normalizedQuery)) : db.prepare(
      `
            SELECT id, type, name, username, NULL as password, url, NULL as notes, createdAt, updatedAt
            FROM items
            ORDER BY updatedAt DESC;
          `
    ).all();
    return this.attachTags(rows);
  }
  getItem(id) {
    const db = this.requireDb();
    this.touchActivity();
    const row = db.prepare(
      `
        SELECT id, type, name, username, password, url, notes, createdAt, updatedAt
        FROM items
        WHERE id = ?;
      `
    ).get(id);
    if (!row) return null;
    return this.attachTags([row])[0];
  }
  createItem(payload) {
    const db = this.requireDb();
    this.touchActivity();
    const id = randomUUID();
    const now = Date.now();
    const item = {
      id,
      type: payload.type,
      name: sanitizeName(payload.name),
      username: sanitizeNullableText(payload.username),
      password: sanitizeNullableText(payload.password),
      url: sanitizeNullableText(payload.url),
      notes: sanitizeNullableText(payload.notes),
      createdAt: now,
      updatedAt: now
    };
    db.prepare(
      `
      INSERT INTO items (id, type, name, username, password, url, notes, createdAt, updatedAt)
      VALUES (@id, @type, @name, @username, @password, @url, @notes, @createdAt, @updatedAt);
    `
    ).run(item);
    return this.getItem(id);
  }
  updateItem(id, payload) {
    const db = this.requireDb();
    this.touchActivity();
    const updates = [];
    const params = { id, updatedAt: Date.now() };
    if (payload.type !== void 0) {
      updates.push("type = @type");
      params.type = payload.type;
    }
    if (payload.name !== void 0) {
      updates.push("name = @name");
      params.name = sanitizeName(payload.name);
    }
    if (payload.username !== void 0) {
      updates.push("username = @username");
      params.username = sanitizeNullableText(payload.username);
    }
    if (payload.password !== void 0) {
      updates.push("password = @password");
      params.password = sanitizeNullableText(payload.password);
    }
    if (payload.url !== void 0) {
      updates.push("url = @url");
      params.url = sanitizeNullableText(payload.url);
    }
    if (payload.notes !== void 0) {
      updates.push("notes = @notes");
      params.notes = sanitizeNullableText(payload.notes);
    }
    updates.push("updatedAt = @updatedAt");
    const result = db.prepare(`UPDATE items SET ${updates.join(", ")} WHERE id = @id;`).run(params);
    if (result.changes === 0) return null;
    return this.getItem(id);
  }
  deleteItem(id) {
    const db = this.requireDb();
    this.touchActivity();
    db.prepare("DELETE FROM items WHERE id = ?;").run(id);
  }
  listTags() {
    const db = this.requireDb();
    this.touchActivity();
    return db.prepare("SELECT id, name FROM tags ORDER BY name COLLATE NOCASE ASC;").all();
  }
  createTag(name) {
    const db = this.requireDb();
    this.touchActivity();
    const normalized = sanitizeName(name);
    const id = randomUUID();
    db.prepare("INSERT INTO tags (id, name) VALUES (?, ?);").run(id, normalized);
    return { id, name: normalized };
  }
  deleteTag(id) {
    const db = this.requireDb();
    this.touchActivity();
    db.prepare("DELETE FROM tags WHERE id = ?;").run(id);
  }
  setItemTags(itemId, tagIds) {
    const db = this.requireDb();
    this.touchActivity();
    const dedupedTagIds = [...new Set(tagIds)];
    const tx = db.transaction((targetItemId, targetTagIds) => {
      const exists = db.prepare("SELECT 1 FROM items WHERE id = ?;").get(targetItemId);
      if (!exists) {
        throw new Error("Item not found.");
      }
      if (targetTagIds.length > 0) {
        const placeholders = targetTagIds.map(() => "?").join(",");
        const countRow = db.prepare(`SELECT COUNT(*) as count FROM tags WHERE id IN (${placeholders});`).get(...targetTagIds);
        if (countRow.count !== targetTagIds.length) {
          throw new Error("One or more tags do not exist.");
        }
      }
      db.prepare("DELETE FROM item_tags WHERE itemId = ?;").run(targetItemId);
      const insert = db.prepare("INSERT INTO item_tags (itemId, tagId) VALUES (?, ?);");
      for (const tagId of targetTagIds) {
        insert.run(targetItemId, tagId);
      }
    });
    tx(itemId, dedupedTagIds);
  }
  searchParams(query) {
    const likeValue = `%${escapeLikeTerm(query)}%`;
    return [likeValue, likeValue, likeValue];
  }
  attachTags(items) {
    if (items.length === 0) return [];
    const db = this.requireDb();
    const placeholders = items.map(() => "?").join(",");
    const rows = db.prepare(
      `
        SELECT it.itemId as itemId, t.id as id, t.name as name
        FROM item_tags it
        INNER JOIN tags t ON t.id = it.tagId
        WHERE it.itemId IN (${placeholders})
        ORDER BY t.name COLLATE NOCASE ASC;
      `
    ).all(...items.map((item) => item.id));
    const tagsByItem = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const list = tagsByItem.get(row.itemId) ?? [];
      list.push({ id: row.id, name: row.name });
      tagsByItem.set(row.itemId, list);
    }
    return items.map((item) => ({
      ...item,
      tags: tagsByItem.get(item.id) ?? []
    }));
  }
  applySqlcipherKeyAndPragmas(db, password) {
    const escapedPassword = escapePragmaString(password);
    db.exec(`PRAGMA key = '${escapedPassword}';`);
    db.exec(`PRAGMA cipher_page_size = 4096;`);
    db.exec(`PRAGMA kdf_iter = ${this.kdfIter};`);
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA secure_delete = ON;");
    db.exec("PRAGMA journal_mode = DELETE;");
    db.exec("PRAGMA synchronous = FULL;");
  }
  verifyUnlock(db) {
    try {
      const integrityRows = db.pragma("cipher_integrity_check");
      if (integrityRows.length === 0) {
        throw new Error("cipher_integrity_check did not return a result.");
      }
      const firstValue = String(Object.values(integrityRows[0])[0] ?? "").toLowerCase();
      if (firstValue && firstValue !== "ok") {
        throw new Error("cipher_integrity_check failed.");
      }
      return;
    } catch {
      db.pragma("user_version");
    }
  }
  requireDb() {
    if (!this.db) {
      throw new Error("Vault is locked.");
    }
    return this.db;
  }
  requireVaultPath() {
    if (!this.vaultPath) {
      throw new Error("No vault path is set.");
    }
    return this.vaultPath;
  }
  disconnect(emitLocked) {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    if (emitLocked) {
      this.emit("locked");
    }
  }
  scheduleAutoLock() {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
    if (!this.isUnlocked()) return;
    const timeoutMs = this.autoLockMinutes * 60 * 1e3;
    const elapsed = Date.now() - this.lastActivityAt;
    const remainingMs = Math.max(timeoutMs - elapsed, 500);
    this.autoLockTimer = setTimeout(() => {
      if (!this.isUnlocked()) return;
      const idleMs = Date.now() - this.lastActivityAt;
      if (idleMs >= timeoutMs) {
        this.lockVault();
      } else {
        this.scheduleAutoLock();
      }
    }, remainingMs);
  }
}
const vaultService = new VaultService();
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const DEFAULT_CLIPBOARD_CLEAR_MS = 3e4;
const clampZoom = (value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
function toErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}
function ok(data) {
  return { ok: true, data };
}
function fail(code, error) {
  return {
    ok: false,
    error: {
      code,
      message: toErrorMessage(error)
    }
  };
}
function notifyVaultState(unlocked) {
  for (const win2 of BrowserWindow.getAllWindows()) {
    win2.webContents.send("vault:stateChanged", { unlocked });
  }
}
function clearClipboardAfterDelay(snapshot, clearAfterMs) {
  setTimeout(() => {
    if (clipboard.readText() === snapshot) {
      clipboard.clear();
    }
  }, clearAfterMs);
}
function registerIpcHandlers(ipcMain2) {
  vaultService.on("locked", () => notifyVaultState(false));
  vaultService.on("unlocked", () => notifyVaultState(true));
  ipcMain2.handle("app:ping", async () => "pong");
  ipcMain2.handle("vault:create", async (_event, masterPassword, vaultPath) => {
    try {
      const targetPath = (vaultPath == null ? void 0 : vaultPath.trim()) || `${app.getPath("userData")}\\vault.db`;
      vaultService.createVault(masterPassword, targetPath);
      return ok({ unlocked: true, vaultPath: vaultService.getVaultPath() });
    } catch (error) {
      return fail("VAULT_CREATE_FAILED", error);
    }
  });
  ipcMain2.handle("vault:open", async (_event, masterPassword, vaultPath) => {
    try {
      vaultService.openVault(masterPassword, vaultPath);
      return ok({ unlocked: true, vaultPath: vaultService.getVaultPath() });
    } catch (error) {
      return fail("VAULT_OPEN_FAILED", error);
    }
  });
  ipcMain2.handle("vault:lock", async () => {
    vaultService.lockVault();
    return { unlocked: false };
  });
  ipcMain2.handle("vault:isUnlocked", async () => {
    return vaultService.isUnlocked();
  });
  ipcMain2.handle("vault:changeMasterPassword", async (_event, oldPassword, newPassword) => {
    try {
      vaultService.changeMasterPassword(oldPassword, newPassword);
      return true;
    } catch (error) {
      throw new Error(toErrorMessage(error));
    }
  });
  ipcMain2.handle("vault:exportEncryptedVault", async (_event, copyToPath) => {
    try {
      vaultService.exportEncryptedVault(copyToPath);
      return true;
    } catch (error) {
      throw new Error(toErrorMessage(error));
    }
  });
  ipcMain2.handle("vault:getAutoLockMinutes", async () => vaultService.getAutoLockMinutes());
  ipcMain2.handle("vault:setAutoLockMinutes", async (_event, minutes) => {
    return vaultService.setAutoLockMinutes(minutes);
  });
  ipcMain2.handle("vault:touchActivity", async () => {
    vaultService.touchActivity();
    return true;
  });
  ipcMain2.handle("vault:listItems", async (_event, query) => {
    return vaultService.listItems(query);
  });
  ipcMain2.handle("vault:getItem", async (_event, id) => {
    return vaultService.getItem(id);
  });
  ipcMain2.handle("vault:createItem", async (_event, payload) => {
    return vaultService.createItem(payload);
  });
  ipcMain2.handle("vault:updateItem", async (_event, id, payload) => {
    return vaultService.updateItem(id, payload);
  });
  ipcMain2.handle("vault:deleteItem", async (_event, id) => {
    vaultService.deleteItem(id);
    return true;
  });
  ipcMain2.handle("vault:listTags", async () => vaultService.listTags());
  ipcMain2.handle("vault:createTag", async (_event, name) => {
    return vaultService.createTag(name);
  });
  ipcMain2.handle("vault:deleteTag", async (_event, id) => {
    vaultService.deleteTag(id);
    return true;
  });
  ipcMain2.handle("vault:setItemTags", async (_event, itemId, tagIds) => {
    vaultService.setItemTags(itemId, tagIds);
    return true;
  });
  ipcMain2.handle("window:minimize", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    win2 == null ? void 0 : win2.minimize();
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
  ipcMain2.handle("app:reload", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    win2 == null ? void 0 : win2.reload();
  });
  ipcMain2.handle("app:toggleDevTools", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    const wc = win2 == null ? void 0 : win2.webContents;
    if (!wc) return false;
    if (wc.isDevToolsOpened()) {
      wc.closeDevTools();
      return false;
    }
    wc.openDevTools({ mode: "detach" });
    return true;
  });
  ipcMain2.handle("app:zoomIn", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    const wc = win2 == null ? void 0 : win2.webContents;
    if (!wc) return 1;
    const next = clampZoom(wc.getZoomFactor() + ZOOM_STEP);
    wc.setZoomFactor(next);
    return next;
  });
  ipcMain2.handle("app:zoomOut", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    const wc = win2 == null ? void 0 : win2.webContents;
    if (!wc) return 1;
    const next = clampZoom(wc.getZoomFactor() - ZOOM_STEP);
    wc.setZoomFactor(next);
    return next;
  });
  ipcMain2.handle("app:zoomReset", (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    const wc = win2 == null ? void 0 : win2.webContents;
    if (!wc) return 1;
    wc.setZoomFactor(1);
    return 1;
  });
  ipcMain2.handle("app:copyText", async (_event, text) => {
    clipboard.writeText(text ?? "");
    return true;
  });
  ipcMain2.handle("app:copySecret", async (_event, text, clearAfterMs) => {
    const value = text ?? "";
    clipboard.writeText(value);
    clearClipboardAfterDelay(value, clearAfterMs ?? DEFAULT_CLIPBOARD_CLEAR_MS);
    return true;
  });
  ipcMain2.handle("file:import", async (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions = {
      title: "Open Vault",
      properties: ["openFile"],
      filters: [
        { name: "Encrypted Vault", extensions: ["db", "sqlite", "vault"] },
        { name: "All Files", extensions: ["*"] }
      ]
    };
    const result = win2 ? await dialog.showOpenDialog(win2, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  ipcMain2.handle("file:export", async (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions = {
      title: "Export Encrypted Vault Copy",
      defaultPath: "vault-export.db",
      filters: [
        { name: "Encrypted Vault", extensions: ["db"] },
        { name: "All Files", extensions: ["*"] }
      ]
    };
    const result = win2 ? await dialog.showSaveDialog(win2, dialogOptions) : await dialog.showSaveDialog(dialogOptions);
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
process.on("unhandledRejection", (reason) => {
  console.error("[main] Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[main] Uncaught exception:", error);
});
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      // Security-first defaults for a password manager UI
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname$1, "preload.mjs")
    },
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0b0d12",
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : void 0,
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
}).catch((error) => {
  console.error("[main] Failed during app initialization:", error);
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
