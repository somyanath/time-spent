import type { Database } from 'better-sqlite3'

/**
 * A single versioned schema change. `up` performs the change; it runs inside a
 * transaction the runner manages, so it must not open or commit its own.
 *
 * The schema starts empty — tables arrive with the slices that need them, each
 * as a new migration appended to {@link ./migrations/index.ts}.
 */
export interface Migration {
  version: number
  name: string
  up: (db: Database) => void
}

export interface MigrationResult {
  /** Versions applied during this run (empty when already up to date). */
  appliedVersions: number[]
  /** Highest applied version after this run (0 when none are applied). */
  currentVersion: number
}

function ensureBookkeepingTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at TEXT    NOT NULL
    )
  `)
}

function currentVersionOf(db: Database): number {
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as {
    version: number | null
  }
  return row.version ?? 0
}

/**
 * Applies all pending migrations in ascending version order and records each in
 * `schema_migrations`. Idempotent: migrations whose version is already recorded
 * are skipped, so re-running across relaunches is a no-op once up to date.
 *
 * Each migration runs in its own transaction — a failing migration rolls back
 * cleanly and leaves earlier migrations committed.
 */
export function runMigrations(db: Database, migrations: Migration[]): MigrationResult {
  const seen = new Set<number>()
  for (const m of migrations) {
    if (seen.has(m.version)) {
      throw new Error(`Migration error: duplicate version ${m.version}`)
    }
    seen.add(m.version)
  }

  const ordered = [...migrations].sort((a, b) => a.version - b.version)

  ensureBookkeepingTable(db)

  const record = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  )

  const appliedVersions: number[] = []
  for (const migration of ordered) {
    if (migration.version <= currentVersionOf(db)) continue

    const apply = db.transaction(() => {
      migration.up(db)
      record.run(migration.version, migration.name, new Date().toISOString())
    })
    apply()
    appliedVersions.push(migration.version)
  }

  return { appliedVersions, currentVersion: currentVersionOf(db) }
}
