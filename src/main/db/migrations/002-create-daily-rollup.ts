import type { Migration } from './types'

/**
 * The daily rollup cache: a fast read path over derived Spans, keyed by
 * local calendar day. Cache only, never a replacement for raw heartbeats
 * (ADR-0001) — always safely re-derivable by deleting a row.
 */
export const createDailyRollup: Migration = {
  version: 2,
  name: 'create_daily_rollup',
  up: (db) => {
    db.exec(`
      CREATE TABLE daily_rollup (
        date TEXT PRIMARY KEY,
        heartbeat_count INTEGER NOT NULL,
        spans_json TEXT NOT NULL,
        computed_at INTEGER NOT NULL
      );
    `)
  },
}
