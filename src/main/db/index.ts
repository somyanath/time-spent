import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { runMigrations, type MigrationResult } from './migrations'
import { migrations } from './migrations/index'

export type { Migration, MigrationResult } from './migrations'
export { runMigrations } from './migrations'

/**
 * Opens (creating if needed) the SQLite database at `dbPath`, applies pending
 * migrations, and returns the live connection. The parent directory is created
 * if missing so first launch works against an empty
 * `~/Library/Application Support/<app>/` directory.
 *
 * Path resolution lives in the caller (main process, via `app.getPath`) so this
 * module stays free of Electron and testable under plain Node.
 */
export function openDatabase(dbPath: string): {
  db: Database.Database
  migration: MigrationResult
} {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true })
  }

  const db = new Database(dbPath)
  // WAL improves concurrent read performance and is the right default for an
  // always-on writer with read-heavy dashboards (ADR-0001 derive-on-read).
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const migration = runMigrations(db, migrations)
  return { db, migration }
}
