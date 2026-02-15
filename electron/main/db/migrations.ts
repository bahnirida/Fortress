import type Database from 'better-sqlite3'

const SCHEMA_VERSION = 1

function migrationV1(db: Database.Database): void {
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
  `)
}

export function runMigrations(db: Database.Database): void {
  const currentVersionRow = db.prepare('PRAGMA user_version;').get() as { user_version: number }
  const currentVersion = Number(currentVersionRow.user_version ?? 0)

  if (currentVersion > SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version ${currentVersion}. App supports up to ${SCHEMA_VERSION}.`)
  }

  if (currentVersion < 1) {
    migrationV1(db)
    db.prepare('PRAGMA user_version = 1;').run()
  }
}

export { SCHEMA_VERSION }
