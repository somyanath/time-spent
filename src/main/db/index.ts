import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { migrations, runMigrations } from './migrations'
import type { MigrationResult } from './migrations'

export interface OpenDatabaseResult {
  db: Database.Database
  migration: MigrationResult
}

/**
 * Open (creating if needed) the SQLite database at `dbPath`, apply pragmas
 * suited to a long-lived local writer, and run pending migrations.
 *
 * WAL keeps the append-only heartbeat writer from blocking dashboard reads;
 * `foreign_keys` is on so future relational tables are enforced. The parent
 * directory (e.g. `~/Library/Application Support/<app>/`) is created if absent.
 */
export function openDatabase(dbPath: string): OpenDatabaseResult {
  mkdirSync(dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const migration = runMigrations(db, migrations)

  return { db, migration }
}
