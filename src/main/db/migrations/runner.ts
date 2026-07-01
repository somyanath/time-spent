import type Database from 'better-sqlite3'
import type { Migration, MigrationResult } from './types'

/**
 * Apply every migration newer than the database's stored schema version, in
 * ascending version order, inside a single transaction.
 *
 * The stored version is SQLite's `user_version` pragma, so no bookkeeping table
 * is needed and the runner is idempotent across relaunches: migrations at or
 * below the current version are skipped. The whole run is atomic — if any
 * migration throws, the transaction rolls back and `user_version` is untouched,
 * so a failed startup never leaves a half-migrated database.
 */
export function runMigrations(
  db: Database.Database,
  migrations: readonly Migration[],
): MigrationResult {
  const sorted = validateAndSort(migrations)
  const startVersion = db.pragma('user_version', { simple: true }) as number
  const appliedVersions: number[] = []

  const applyAll = db.transaction(() => {
    for (const migration of sorted) {
      if (migration.version <= startVersion) continue
      migration.up(db)
      // PRAGMA user_version is transactional, so this rolls back with the run.
      db.pragma(`user_version = ${migration.version}`)
      appliedVersions.push(migration.version)
    }
  })

  applyAll()

  return {
    appliedVersions,
    currentVersion: db.pragma('user_version', { simple: true }) as number,
  }
}

function validateAndSort(migrations: readonly Migration[]): Migration[] {
  const seen = new Set<number>()
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new Error(
        `Migration "${migration.name}" has a non-positive version (${migration.version}); versions must be positive integers.`,
      )
    }
    if (seen.has(migration.version)) {
      throw new Error(
        `Duplicate migration version ${migration.version} ("${migration.name}"); versions must be unique.`,
      )
    }
    seen.add(migration.version)
  }
  return [...migrations].sort((a, b) => a.version - b.version)
}
