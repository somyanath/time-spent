import type Database from 'better-sqlite3'

/**
 * A single, ordered, forward-only schema migration.
 *
 * Per ADR-0001 the schema exists only to hold append-only heartbeats and the
 * derived-on-read caches — it starts empty in slice 1 and grows one migration
 * at a time as later slices need tables. Migrations never mutate observed data;
 * they only shape the container.
 */
export interface Migration {
  /** Strictly positive, unique, increasing. Maps to SQLite's `user_version`. */
  version: number
  /** Human-readable identifier for logs and diffs. */
  name: string
  /** Applies the forward change. Runs inside the migration transaction. */
  up: (db: Database.Database) => void
}

export interface MigrationResult {
  /** Versions applied during this run, in ascending order (empty if none). */
  appliedVersions: number[]
  /** The schema version after this run (SQLite `user_version`). */
  currentVersion: number
}
