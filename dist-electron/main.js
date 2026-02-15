var V = Object.defineProperty;
var M = (n, s, e) => s in n ? V(n, s, { enumerable: !0, configurable: !0, writable: !0, value: e }) : n[s] = e;
var m = (n, s, e) => M(n, typeof s != "symbol" ? s + "" : s, e);
import { app as p, BrowserWindow as c, clipboard as w, dialog as f, ipcMain as F } from "electron";
import { fileURLToPath as W } from "node:url";
import l from "node:path";
import { EventEmitter as X } from "node:events";
import E from "node:fs";
import { randomUUID as y } from "node:crypto";
import g from "better-sqlite3";
const R = 1;
function q(n) {
  n.exec(`
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
function O(n) {
  const s = n.prepare("PRAGMA user_version;").get(), e = Number(s.user_version ?? 0);
  if (e > R)
    throw new Error(`Unsupported schema version ${e}. App supports up to ${R}.`);
  e < 1 && (q(n), n.prepare("PRAGMA user_version = 1;").run());
}
const z = 256e3, C = 10, K = 1, B = 240;
function _(n) {
  return n.replace(/'/g, "''");
}
function h(n) {
  if (n == null) return null;
  const s = n.trim();
  return s.length > 0 ? s : null;
}
function I(n) {
  const s = n.trim();
  if (!s)
    throw new Error("Item name is required.");
  return s;
}
function G(n) {
  return n.replace(/([%_\\])/g, "\\$1");
}
function k(n) {
  return Number.isFinite(n) ? Math.min(B, Math.max(K, Math.floor(n))) : C;
}
class j extends X {
  constructor(e) {
    super();
    m(this, "db", null);
    m(this, "vaultPath", null);
    m(this, "kdfIter");
    m(this, "autoLockMinutes");
    m(this, "lastActivityAt", Date.now());
    m(this, "autoLockTimer", null);
    this.kdfIter = (e == null ? void 0 : e.kdfIter) ?? z, this.autoLockMinutes = k((e == null ? void 0 : e.autoLockMinutes) ?? C);
  }
  on(e, t) {
    return super.on(e, t);
  }
  emit(e) {
    return super.emit(e);
  }
  createVault(e, t) {
    if (!e)
      throw new Error("Master password is required.");
    const r = l.resolve(t), o = l.dirname(r);
    if (E.mkdirSync(o, { recursive: !0 }), E.existsSync(r) && E.statSync(r).size > 0)
      throw new Error("Vault file already exists and is not empty.");
    this.disconnect(!1);
    const i = new g(r);
    try {
      this.applySqlcipherKeyAndPragmas(i, e), O(i), this.verifyUnlock(i), this.db = i, this.vaultPath = r, this.touchActivity(), this.emit("unlocked");
    } catch (u) {
      throw i.close(), u;
    }
  }
  openVault(e, t) {
    if (!e)
      throw new Error("Master password is required.");
    const r = l.resolve(t);
    if (!E.existsSync(r))
      throw new Error("Vault file was not found.");
    this.disconnect(!1);
    const o = new g(r);
    try {
      this.applySqlcipherKeyAndPragmas(o, e), this.verifyUnlock(o), O(o), this.db = o, this.vaultPath = r, this.touchActivity(), this.emit("unlocked");
    } catch {
      throw o.close(), new Error("Unable to unlock vault. Check password or file integrity.");
    }
  }
  lockVault() {
    this.disconnect(!0);
  }
  isUnlocked() {
    return this.db !== null;
  }
  getVaultPath() {
    return this.vaultPath;
  }
  changeMasterPassword(e, t) {
    if (!e || !t)
      throw new Error("Both old and new master passwords are required.");
    const r = this.requireDb(), o = this.requireVaultPath(), i = new g(o, { readonly: !0 });
    try {
      this.applySqlcipherKeyAndPragmas(i, e), this.verifyUnlock(i);
    } catch {
      throw new Error("Old master password is incorrect.");
    } finally {
      i.close();
    }
    const u = _(t);
    r.exec(`PRAGMA rekey = '${u}';`), this.touchActivity();
  }
  exportEncryptedVault(e) {
    const t = this.requireVaultPath();
    if (!this.isUnlocked())
      throw new Error("Vault must be unlocked before export.");
    const r = l.resolve(e);
    E.mkdirSync(l.dirname(r), { recursive: !0 }), E.copyFileSync(t, r);
  }
  setAutoLockMinutes(e) {
    return this.autoLockMinutes = k(e), this.scheduleAutoLock(), this.autoLockMinutes;
  }
  getAutoLockMinutes() {
    return this.autoLockMinutes;
  }
  touchActivity() {
    this.isUnlocked() && (this.lastActivityAt = Date.now(), this.scheduleAutoLock());
  }
  listItems(e) {
    const t = this.requireDb();
    this.touchActivity();
    const r = e == null ? void 0 : e.trim(), o = r ? t.prepare(
      `
            SELECT id, type, name, username, NULL as password, url, NULL as notes, createdAt, updatedAt
            FROM items
            WHERE name LIKE ? ESCAPE '\\'
               OR url LIKE ? ESCAPE '\\'
               OR username LIKE ? ESCAPE '\\'
            ORDER BY updatedAt DESC;
          `
    ).all(...this.searchParams(r)) : t.prepare(
      `
            SELECT id, type, name, username, NULL as password, url, NULL as notes, createdAt, updatedAt
            FROM items
            ORDER BY updatedAt DESC;
          `
    ).all();
    return this.attachTags(o);
  }
  getItem(e) {
    const t = this.requireDb();
    this.touchActivity();
    const r = t.prepare(
      `
        SELECT id, type, name, username, password, url, notes, createdAt, updatedAt
        FROM items
        WHERE id = ?;
      `
    ).get(e);
    return r ? this.attachTags([r])[0] : null;
  }
  createItem(e) {
    const t = this.requireDb();
    this.touchActivity();
    const r = y(), o = Date.now(), i = {
      id: r,
      type: e.type,
      name: I(e.name),
      username: h(e.username),
      password: h(e.password),
      url: h(e.url),
      notes: h(e.notes),
      createdAt: o,
      updatedAt: o
    };
    return t.prepare(
      `
      INSERT INTO items (id, type, name, username, password, url, notes, createdAt, updatedAt)
      VALUES (@id, @type, @name, @username, @password, @url, @notes, @createdAt, @updatedAt);
    `
    ).run(i), this.getItem(r);
  }
  updateItem(e, t) {
    const r = this.requireDb();
    this.touchActivity();
    const o = [], i = { id: e, updatedAt: Date.now() };
    return t.type !== void 0 && (o.push("type = @type"), i.type = t.type), t.name !== void 0 && (o.push("name = @name"), i.name = I(t.name)), t.username !== void 0 && (o.push("username = @username"), i.username = h(t.username)), t.password !== void 0 && (o.push("password = @password"), i.password = h(t.password)), t.url !== void 0 && (o.push("url = @url"), i.url = h(t.url)), t.notes !== void 0 && (o.push("notes = @notes"), i.notes = h(t.notes)), o.push("updatedAt = @updatedAt"), r.prepare(`UPDATE items SET ${o.join(", ")} WHERE id = @id;`).run(i).changes === 0 ? null : this.getItem(e);
  }
  deleteItem(e) {
    const t = this.requireDb();
    this.touchActivity(), t.prepare("DELETE FROM items WHERE id = ?;").run(e);
  }
  listTags() {
    const e = this.requireDb();
    return this.touchActivity(), e.prepare("SELECT id, name FROM tags ORDER BY name COLLATE NOCASE ASC;").all();
  }
  createTag(e) {
    const t = this.requireDb();
    this.touchActivity();
    const r = I(e), o = y();
    return t.prepare("INSERT INTO tags (id, name) VALUES (?, ?);").run(o, r), { id: o, name: r };
  }
  deleteTag(e) {
    const t = this.requireDb();
    this.touchActivity(), t.prepare("DELETE FROM tags WHERE id = ?;").run(e);
  }
  setItemTags(e, t) {
    const r = this.requireDb();
    this.touchActivity();
    const o = [...new Set(t)];
    r.transaction((u, d) => {
      if (!r.prepare("SELECT 1 FROM items WHERE id = ?;").get(u))
        throw new Error("Item not found.");
      if (d.length > 0) {
        const v = d.map(() => "?").join(",");
        if (r.prepare(`SELECT COUNT(*) as count FROM tags WHERE id IN (${v});`).get(...d).count !== d.length)
          throw new Error("One or more tags do not exist.");
      }
      r.prepare("DELETE FROM item_tags WHERE itemId = ?;").run(u);
      const U = r.prepare("INSERT INTO item_tags (itemId, tagId) VALUES (?, ?);");
      for (const v of d)
        U.run(u, v);
    })(e, o);
  }
  searchParams(e) {
    const t = `%${G(e)}%`;
    return [t, t, t];
  }
  attachTags(e) {
    if (e.length === 0) return [];
    const t = this.requireDb(), r = e.map(() => "?").join(","), o = t.prepare(
      `
        SELECT it.itemId as itemId, t.id as id, t.name as name
        FROM item_tags it
        INNER JOIN tags t ON t.id = it.tagId
        WHERE it.itemId IN (${r})
        ORDER BY t.name COLLATE NOCASE ASC;
      `
    ).all(...e.map((u) => u.id)), i = /* @__PURE__ */ new Map();
    for (const u of o) {
      const d = i.get(u.itemId) ?? [];
      d.push({ id: u.id, name: u.name }), i.set(u.itemId, d);
    }
    return e.map((u) => ({
      ...u,
      tags: i.get(u.id) ?? []
    }));
  }
  applySqlcipherKeyAndPragmas(e, t) {
    const r = _(t);
    e.exec(`PRAGMA key = '${r}';`), e.exec("PRAGMA cipher_page_size = 4096;"), e.exec(`PRAGMA kdf_iter = ${this.kdfIter};`), e.exec("PRAGMA foreign_keys = ON;"), e.exec("PRAGMA secure_delete = ON;"), e.exec("PRAGMA journal_mode = DELETE;"), e.exec("PRAGMA synchronous = FULL;");
  }
  verifyUnlock(e) {
    try {
      const t = e.pragma("cipher_integrity_check");
      if (t.length === 0)
        throw new Error("cipher_integrity_check did not return a result.");
      const r = String(Object.values(t[0])[0] ?? "").toLowerCase();
      if (r && r !== "ok")
        throw new Error("cipher_integrity_check failed.");
      return;
    } catch {
      e.pragma("user_version");
    }
  }
  requireDb() {
    if (!this.db)
      throw new Error("Vault is locked.");
    return this.db;
  }
  requireVaultPath() {
    if (!this.vaultPath)
      throw new Error("No vault path is set.");
    return this.vaultPath;
  }
  disconnect(e) {
    this.autoLockTimer && (clearTimeout(this.autoLockTimer), this.autoLockTimer = null), this.db && (this.db.close(), this.db = null), e && this.emit("locked");
  }
  scheduleAutoLock() {
    if (this.autoLockTimer && (clearTimeout(this.autoLockTimer), this.autoLockTimer = null), !this.isUnlocked()) return;
    const e = this.autoLockMinutes * 60 * 1e3, t = Date.now() - this.lastActivityAt, r = Math.max(e - t, 500);
    this.autoLockTimer = setTimeout(() => {
      if (!this.isUnlocked()) return;
      Date.now() - this.lastActivityAt >= e ? this.lockVault() : this.scheduleAutoLock();
    }, r);
  }
}
const a = new j(), H = 0.5, Y = 3, N = 0.1, $ = 3e4, S = (n) => Math.min(Y, Math.max(H, n));
function T(n) {
  return n instanceof Error ? n.message : "Unexpected error";
}
function b(n) {
  for (const s of c.getAllWindows())
    s.webContents.send("vault:stateChanged", { unlocked: n });
}
function Z(n, s) {
  setTimeout(() => {
    w.readText() === n && w.clear();
  }, s);
}
function Q(n) {
  a.on("locked", () => b(!1)), a.on("unlocked", () => b(!0)), n.handle("app:ping", async () => "pong"), n.handle("vault:create", async (s, e, t) => {
    try {
      const r = (t == null ? void 0 : t.trim()) || `${p.getPath("userData")}\\vault.db`;
      return a.createVault(e, r), { unlocked: !0, vaultPath: a.getVaultPath() };
    } catch (r) {
      throw new Error(T(r));
    }
  }), n.handle("vault:open", async (s, e, t) => {
    try {
      return a.openVault(e, t), { unlocked: !0, vaultPath: a.getVaultPath() };
    } catch (r) {
      throw new Error(T(r));
    }
  }), n.handle("vault:lock", async () => (a.lockVault(), { unlocked: !1 })), n.handle("vault:isUnlocked", async () => a.isUnlocked()), n.handle("vault:changeMasterPassword", async (s, e, t) => {
    try {
      return a.changeMasterPassword(e, t), !0;
    } catch (r) {
      throw new Error(T(r));
    }
  }), n.handle("vault:exportEncryptedVault", async (s, e) => {
    try {
      return a.exportEncryptedVault(e), !0;
    } catch (t) {
      throw new Error(T(t));
    }
  }), n.handle("vault:getAutoLockMinutes", async () => a.getAutoLockMinutes()), n.handle("vault:setAutoLockMinutes", async (s, e) => a.setAutoLockMinutes(e)), n.handle("vault:touchActivity", async () => (a.touchActivity(), !0)), n.handle("vault:listItems", async (s, e) => a.listItems(e)), n.handle("vault:getItem", async (s, e) => a.getItem(e)), n.handle("vault:createItem", async (s, e) => a.createItem(e)), n.handle("vault:updateItem", async (s, e, t) => a.updateItem(e, t)), n.handle("vault:deleteItem", async (s, e) => (a.deleteItem(e), !0)), n.handle("vault:listTags", async () => a.listTags()), n.handle("vault:createTag", async (s, e) => a.createTag(e)), n.handle("vault:deleteTag", async (s, e) => (a.deleteTag(e), !0)), n.handle("vault:setItemTags", async (s, e, t) => (a.setItemTags(e, t), !0)), n.handle("window:minimize", (s) => {
    const e = c.fromWebContents(s.sender);
    e == null || e.minimize();
  }), n.handle("window:isMaximized", (s) => {
    const e = c.fromWebContents(s.sender);
    return (e == null ? void 0 : e.isMaximized()) ?? !1;
  }), n.handle("window:toggleMaximize", (s) => {
    const e = c.fromWebContents(s.sender);
    return e ? e.isMaximized() ? (e.unmaximize(), !1) : (e.maximize(), !0) : !1;
  }), n.handle("window:close", (s) => {
    const e = c.fromWebContents(s.sender);
    e == null || e.close();
  }), n.handle("app:reload", (s) => {
    const e = c.fromWebContents(s.sender);
    e == null || e.reload();
  }), n.handle("app:toggleDevTools", (s) => {
    const e = c.fromWebContents(s.sender), t = e == null ? void 0 : e.webContents;
    return t ? t.isDevToolsOpened() ? (t.closeDevTools(), !1) : (t.openDevTools({ mode: "detach" }), !0) : !1;
  }), n.handle("app:zoomIn", (s) => {
    const e = c.fromWebContents(s.sender), t = e == null ? void 0 : e.webContents;
    if (!t) return 1;
    const r = S(t.getZoomFactor() + N);
    return t.setZoomFactor(r), r;
  }), n.handle("app:zoomOut", (s) => {
    const e = c.fromWebContents(s.sender), t = e == null ? void 0 : e.webContents;
    if (!t) return 1;
    const r = S(t.getZoomFactor() - N);
    return t.setZoomFactor(r), r;
  }), n.handle("app:zoomReset", (s) => {
    const e = c.fromWebContents(s.sender), t = e == null ? void 0 : e.webContents;
    return t && t.setZoomFactor(1), 1;
  }), n.handle("app:copyText", async (s, e) => (w.writeText(e ?? ""), !0)), n.handle("app:copySecret", async (s, e, t) => {
    const r = e ?? "";
    return w.writeText(r), Z(r, t ?? $), !0;
  }), n.handle("file:import", async (s) => {
    const e = c.fromWebContents(s.sender), t = {
      title: "Open Vault",
      properties: ["openFile"],
      filters: [
        { name: "Encrypted Vault", extensions: ["db", "sqlite", "vault"] },
        { name: "All Files", extensions: ["*"] }
      ]
    }, r = e ? await f.showOpenDialog(e, t) : await f.showOpenDialog(t);
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
  }), n.handle("file:export", async (s) => {
    const e = c.fromWebContents(s.sender), t = {
      title: "Export Encrypted Vault Copy",
      defaultPath: "vault-export.db",
      filters: [
        { name: "Encrypted Vault", extensions: ["db"] },
        { name: "All Files", extensions: ["*"] }
      ]
    }, r = e ? await f.showSaveDialog(e, t) : await f.showSaveDialog(t);
    return r.canceled || !r.filePath ? null : r.filePath;
  });
}
const D = l.dirname(W(import.meta.url));
process.env.APP_ROOT = l.join(D, "..");
const L = process.env.VITE_DEV_SERVER_URL, ce = l.join(process.env.APP_ROOT, "dist-electron"), P = l.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = L ? l.join(process.env.APP_ROOT, "public") : P;
let A;
function x() {
  A = new c({
    icon: l.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      // Security-first defaults for a password manager UI
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !0,
      preload: l.join(D, "preload.mjs")
    },
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0b0d12",
    frame: !1,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : void 0,
    trafficLightPosition: process.platform === "darwin" ? { x: 12, y: 14 } : void 0
  }), L ? A.loadURL(L) : A.loadFile(l.join(P, "index.html"));
}
p.on("window-all-closed", () => {
  process.platform !== "darwin" && (p.quit(), A = null);
});
p.on("activate", () => {
  c.getAllWindows().length === 0 && x();
});
p.whenReady().then(() => {
  Q(F), x();
});
export {
  ce as MAIN_DIST,
  P as RENDERER_DIST,
  L as VITE_DEV_SERVER_URL
};
