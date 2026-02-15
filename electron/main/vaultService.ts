import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import type BetterSqlite3 from 'better-sqlite3'
import { runMigrations } from './db/migrations'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof BetterSqlite3
type DatabaseInstance = BetterSqlite3.Database

const DEFAULT_KDF_ITER = 256000
const DEFAULT_AUTO_LOCK_MINUTES = 10
const MIN_AUTO_LOCK_MINUTES = 1
const MAX_AUTO_LOCK_MINUTES = 240

export type VaultItemType = 'password' | 'note'

export type VaultTag = {
  id: string
  name: string
}

export type VaultItem = {
  id: string
  type: VaultItemType
  name: string
  username: string | null
  password: string | null
  url: string | null
  notes: string | null
  createdAt: number
  updatedAt: number
  tags: VaultTag[]
}

export type CreateItemPayload = {
  type: VaultItemType
  name: string
  username?: string | null
  password?: string | null
  url?: string | null
  notes?: string | null
}

export type UpdateItemPayload = Partial<CreateItemPayload>

type ServiceEvents = {
  locked: () => void
  unlocked: () => void
}

export type VaultServiceOptions = {
  kdfIter?: number
  autoLockMinutes?: number
}

function escapePragmaString(value: string): string {
  return value.replace(/'/g, "''")
}

function sanitizeNullableText(value?: string | null): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function sanitizeName(value: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error('Item name is required.')
  }
  return normalized
}

function escapeLikeTerm(value: string): string {
  return value.replace(/([%_\\])/g, '\\$1')
}

function normalizeAutoLockMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUTO_LOCK_MINUTES
  return Math.min(MAX_AUTO_LOCK_MINUTES, Math.max(MIN_AUTO_LOCK_MINUTES, Math.floor(value)))
}

class VaultService extends EventEmitter {
  private db: DatabaseInstance | null = null
  private vaultPath: string | null = null
  private kdfIter: number
  private autoLockMinutes: number
  private lastActivityAt = Date.now()
  private autoLockTimer: NodeJS.Timeout | null = null

  constructor(options?: VaultServiceOptions) {
    super()
    this.kdfIter = options?.kdfIter ?? DEFAULT_KDF_ITER
    this.autoLockMinutes = normalizeAutoLockMinutes(options?.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES)
  }

  override on<E extends keyof ServiceEvents>(event: E, listener: ServiceEvents[E]): this {
    return super.on(event, listener)
  }

  override emit<E extends keyof ServiceEvents>(event: E): boolean {
    return super.emit(event)
  }

  createVault(masterPassword: string, rawVaultPath: string): void {
    if (!masterPassword) {
      throw new Error('Master password is required.')
    }
    const resolvedPath = path.resolve(rawVaultPath)
    const parentDir = path.dirname(resolvedPath)
    fs.mkdirSync(parentDir, { recursive: true })

    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).size > 0) {
      throw new Error('Vault file already exists and is not empty.')
    }

    this.disconnect(false)

    const db = new Database(resolvedPath)
    try {
      this.applySqlcipherKeyAndPragmas(db, masterPassword)
      runMigrations(db)
      this.verifyUnlock(db)
      this.db = db
      this.vaultPath = resolvedPath
      this.touchActivity()
      this.emit('unlocked')
    } catch (error) {
      db.close()
      throw error
    }
  }

  openVault(masterPassword: string, rawVaultPath: string): void {
    if (!masterPassword) {
      throw new Error('Master password is required.')
    }
    const resolvedPath = path.resolve(rawVaultPath)
    if (!fs.existsSync(resolvedPath)) {
      throw new Error('Vault file was not found.')
    }

    this.disconnect(false)

    const db = new Database(resolvedPath)
    try {
      this.applySqlcipherKeyAndPragmas(db, masterPassword)
      this.verifyUnlock(db)
      runMigrations(db)
      this.db = db
      this.vaultPath = resolvedPath
      this.touchActivity()
      this.emit('unlocked')
    } catch {
      db.close()
      throw new Error('Unable to unlock vault. Check password or file integrity.')
    }
  }

  lockVault(): void {
    this.disconnect(true)
  }

  isUnlocked(): boolean {
    return this.db !== null
  }

  getVaultPath(): string | null {
    return this.vaultPath
  }

  changeMasterPassword(oldPassword: string, newPassword: string): void {
    if (!oldPassword || !newPassword) {
      throw new Error('Both old and new master passwords are required.')
    }
    const db = this.requireDb()
    const currentPath = this.requireVaultPath()

    const probe = new Database(currentPath, { readonly: true })
    try {
      this.applySqlcipherKeyAndPragmas(probe, oldPassword)
      this.verifyUnlock(probe)
    } catch {
      throw new Error('Old master password is incorrect.')
    } finally {
      probe.close()
    }

    const escapedNew = escapePragmaString(newPassword)
    db.exec(`PRAGMA rekey = '${escapedNew}';`)
    this.touchActivity()
  }

  exportEncryptedVault(copyToPath: string): void {
    const sourcePath = this.requireVaultPath()
    if (!this.isUnlocked()) {
      throw new Error('Vault must be unlocked before export.')
    }
    const resolvedDestination = path.resolve(copyToPath)
    fs.mkdirSync(path.dirname(resolvedDestination), { recursive: true })
    fs.copyFileSync(sourcePath, resolvedDestination)
  }

  setAutoLockMinutes(minutes: number): number {
    this.autoLockMinutes = normalizeAutoLockMinutes(minutes)
    this.scheduleAutoLock()
    return this.autoLockMinutes
  }

  getAutoLockMinutes(): number {
    return this.autoLockMinutes
  }

  touchActivity(): void {
    if (!this.isUnlocked()) return
    this.lastActivityAt = Date.now()
    this.scheduleAutoLock()
  }

  listItems(query?: string): VaultItem[] {
    const db = this.requireDb()
    this.touchActivity()

    const normalizedQuery = query?.trim()
    const rows = normalizedQuery
      ? db
          .prepare(
            `
            SELECT id, type, name, username, NULL as password, url, NULL as notes, createdAt, updatedAt
            FROM items
            WHERE name LIKE ? ESCAPE '\\'
               OR url LIKE ? ESCAPE '\\'
               OR username LIKE ? ESCAPE '\\'
            ORDER BY updatedAt DESC;
          `,
          )
          .all(...this.searchParams(normalizedQuery))
      : db
          .prepare(
            `
            SELECT id, type, name, username, NULL as password, url, NULL as notes, createdAt, updatedAt
            FROM items
            ORDER BY updatedAt DESC;
          `,
          )
          .all()

    return this.attachTags(rows as VaultItem[])
  }

  getItem(id: string): VaultItem | null {
    const db = this.requireDb()
    this.touchActivity()

    const row = db
      .prepare(
        `
        SELECT id, type, name, username, password, url, notes, createdAt, updatedAt
        FROM items
        WHERE id = ?;
      `,
      )
      .get(id) as VaultItem | undefined

    if (!row) return null
    return this.attachTags([row])[0]
  }

  createItem(payload: CreateItemPayload): VaultItem {
    const db = this.requireDb()
    this.touchActivity()

    const id = randomUUID()
    const now = Date.now()

    const item = {
      id,
      type: payload.type,
      name: sanitizeName(payload.name),
      username: sanitizeNullableText(payload.username),
      password: sanitizeNullableText(payload.password),
      url: sanitizeNullableText(payload.url),
      notes: sanitizeNullableText(payload.notes),
      createdAt: now,
      updatedAt: now,
    }

    db.prepare(
      `
      INSERT INTO items (id, type, name, username, password, url, notes, createdAt, updatedAt)
      VALUES (@id, @type, @name, @username, @password, @url, @notes, @createdAt, @updatedAt);
    `,
    ).run(item)

    return this.getItem(id) as VaultItem
  }

  updateItem(id: string, payload: UpdateItemPayload): VaultItem | null {
    const db = this.requireDb()
    this.touchActivity()

    const updates: string[] = []
    const params: Record<string, unknown> = { id, updatedAt: Date.now() }

    if (payload.type !== undefined) {
      updates.push('type = @type')
      params.type = payload.type
    }
    if (payload.name !== undefined) {
      updates.push('name = @name')
      params.name = sanitizeName(payload.name)
    }
    if (payload.username !== undefined) {
      updates.push('username = @username')
      params.username = sanitizeNullableText(payload.username)
    }
    if (payload.password !== undefined) {
      updates.push('password = @password')
      params.password = sanitizeNullableText(payload.password)
    }
    if (payload.url !== undefined) {
      updates.push('url = @url')
      params.url = sanitizeNullableText(payload.url)
    }
    if (payload.notes !== undefined) {
      updates.push('notes = @notes')
      params.notes = sanitizeNullableText(payload.notes)
    }

    updates.push('updatedAt = @updatedAt')

    const result = db
      .prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = @id;`)
      .run(params)

    if (result.changes === 0) return null
    return this.getItem(id)
  }

  deleteItem(id: string): void {
    const db = this.requireDb()
    this.touchActivity()
    db.prepare('DELETE FROM items WHERE id = ?;').run(id)
  }

  listTags(): VaultTag[] {
    const db = this.requireDb()
    this.touchActivity()
    return db
      .prepare('SELECT id, name FROM tags ORDER BY name COLLATE NOCASE ASC;')
      .all() as VaultTag[]
  }

  createTag(name: string): VaultTag {
    const db = this.requireDb()
    this.touchActivity()

    const normalized = sanitizeName(name)
    const id = randomUUID()

    db.prepare('INSERT INTO tags (id, name) VALUES (?, ?);').run(id, normalized)
    return { id, name: normalized }
  }

  deleteTag(id: string): void {
    const db = this.requireDb()
    this.touchActivity()
    db.prepare('DELETE FROM tags WHERE id = ?;').run(id)
  }

  setItemTags(itemId: string, tagIds: string[]): void {
    const db = this.requireDb()
    this.touchActivity()

    const dedupedTagIds = [...new Set(tagIds)]

    const tx = db.transaction((targetItemId: string, targetTagIds: string[]) => {
      const exists = db.prepare('SELECT 1 FROM items WHERE id = ?;').get(targetItemId)
      if (!exists) {
        throw new Error('Item not found.')
      }

      if (targetTagIds.length > 0) {
        const placeholders = targetTagIds.map(() => '?').join(',')
        const countRow = db
          .prepare(`SELECT COUNT(*) as count FROM tags WHERE id IN (${placeholders});`)
          .get(...targetTagIds) as { count: number }
        if (countRow.count !== targetTagIds.length) {
          throw new Error('One or more tags do not exist.')
        }
      }

      db.prepare('DELETE FROM item_tags WHERE itemId = ?;').run(targetItemId)

      const insert = db.prepare('INSERT INTO item_tags (itemId, tagId) VALUES (?, ?);')
      for (const tagId of targetTagIds) {
        insert.run(targetItemId, tagId)
      }
    })

    tx(itemId, dedupedTagIds)
  }

  private searchParams(query: string): [string, string, string] {
    const likeValue = `%${escapeLikeTerm(query)}%`
    return [likeValue, likeValue, likeValue]
  }

  private attachTags(items: VaultItem[]): VaultItem[] {
    if (items.length === 0) return []
    const db = this.requireDb()

    const placeholders = items.map(() => '?').join(',')
    const rows = db
      .prepare(
        `
        SELECT it.itemId as itemId, t.id as id, t.name as name
        FROM item_tags it
        INNER JOIN tags t ON t.id = it.tagId
        WHERE it.itemId IN (${placeholders})
        ORDER BY t.name COLLATE NOCASE ASC;
      `,
      )
      .all(...items.map((item) => item.id)) as Array<{ itemId: string; id: string; name: string }>

    const tagsByItem = new Map<string, VaultTag[]>()
    for (const row of rows) {
      const list = tagsByItem.get(row.itemId) ?? []
      list.push({ id: row.id, name: row.name })
      tagsByItem.set(row.itemId, list)
    }

    return items.map((item) => ({
      ...item,
      tags: tagsByItem.get(item.id) ?? [],
    }))
  }

  private applySqlcipherKeyAndPragmas(db: DatabaseInstance, password: string): void {
    const escapedPassword = escapePragmaString(password)
    db.exec(`PRAGMA key = '${escapedPassword}';`)

    db.exec(`PRAGMA cipher_page_size = 4096;`)
    db.exec(`PRAGMA kdf_iter = ${this.kdfIter};`)
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec('PRAGMA secure_delete = ON;')
    db.exec('PRAGMA journal_mode = DELETE;')
    db.exec('PRAGMA synchronous = FULL;')
  }

  private verifyUnlock(db: DatabaseInstance): void {
    try {
      const integrityRows = db.pragma('cipher_integrity_check') as Array<Record<string, unknown>>
      if (integrityRows.length === 0) {
        throw new Error('cipher_integrity_check did not return a result.')
      }
      const firstValue = String(Object.values(integrityRows[0])[0] ?? '').toLowerCase()
      if (firstValue && firstValue !== 'ok') {
        throw new Error('cipher_integrity_check failed.')
      }
      return
    } catch {
      db.pragma('user_version')
    }
  }

  private requireDb(): DatabaseInstance {
    if (!this.db) {
      throw new Error('Vault is locked.')
    }
    return this.db
  }

  private requireVaultPath(): string {
    if (!this.vaultPath) {
      throw new Error('No vault path is set.')
    }
    return this.vaultPath
  }

  private disconnect(emitLocked: boolean): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer)
      this.autoLockTimer = null
    }

    if (this.db) {
      this.db.close()
      this.db = null
    }

    if (emitLocked) {
      this.emit('locked')
    }
  }

  private scheduleAutoLock(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer)
      this.autoLockTimer = null
    }
    if (!this.isUnlocked()) return

    const timeoutMs = this.autoLockMinutes * 60 * 1000
    const elapsed = Date.now() - this.lastActivityAt
    const remainingMs = Math.max(timeoutMs - elapsed, 500)

    this.autoLockTimer = setTimeout(() => {
      if (!this.isUnlocked()) return
      const idleMs = Date.now() - this.lastActivityAt
      if (idleMs >= timeoutMs) {
        this.lockVault()
      } else {
        this.scheduleAutoLock()
      }
    }, remainingMs)
  }
}

export const vaultService = new VaultService()
