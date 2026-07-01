import type { Migration } from './types'

/**
 * The append-only heartbeats stream (ADR-0001): observed facts only, no
 * derived columns. `window_title`/`url` are nullable and unused until the
 * Screen Recording (#21) and browser-capture (#22) slices populate them.
 */
export const createHeartbeats: Migration = {
  version: 1,
  name: 'create_heartbeats',
  up: (db) => {
    db.exec(`
      CREATE TABLE heartbeats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        app_name TEXT NOT NULL,
        bundle_id TEXT,
        window_title TEXT,
        url TEXT,
        idle_seconds INTEGER NOT NULL
      );

      CREATE INDEX idx_heartbeats_started_at ON heartbeats (started_at);
    `)
  },
}
