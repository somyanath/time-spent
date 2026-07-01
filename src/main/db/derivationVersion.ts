import type Database from 'better-sqlite3'

/** The current categorization version, bumped whenever a Category or Rule is mutated. */
export function getDerivationVersion(db: Database.Database): number {
  const row = db.prepare('SELECT version FROM derivation_version WHERE id = 1').get() as { version: number }
  return row.version
}

/** Call inside the same transaction as a Category/Rule mutation so cached rollups relying on the old version invalidate. */
export function bumpDerivationVersion(db: Database.Database): void {
  db.prepare('UPDATE derivation_version SET version = version + 1 WHERE id = 1').run()
}
