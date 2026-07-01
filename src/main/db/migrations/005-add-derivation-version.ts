import type { Migration } from './types'

/**
 * A single-row counter bumped whenever Categories or Rules are mutated, and
 * stamped onto each `daily_rollup` row alongside `heartbeat_count`. Lets the
 * rollup cache (dailyRollup.ts) detect "a Rule changed" the same way it
 * already detects "new heartbeats arrived" — editing a Rule must re-derive
 * matching history immediately, with no write-time freeze (ADR-0001).
 */
export const addDerivationVersion: Migration = {
  version: 5,
  name: 'add_derivation_version',
  up: (db) => {
    db.exec(`
      CREATE TABLE derivation_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL
      );
      INSERT INTO derivation_version (id, version) VALUES (1, 0);

      ALTER TABLE daily_rollup ADD COLUMN rules_version INTEGER NOT NULL DEFAULT 0;
    `)
  },
}
