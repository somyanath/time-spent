import type { Migration } from './types'

/**
 * Manual Entries: stored, user-authored Spans for time the tracker couldn't
 * observe (offline meetings, calls, a paper notebook). Merged into
 * `derive()`'s output at read time alongside the Heartbeat-derived Spans.
 */
export const createManualEntries: Migration = {
  version: 9,
  name: 'create_manual_entries',
  up: (db) => {
    db.exec(`
      CREATE TABLE manual_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        label TEXT NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_manual_entries_range ON manual_entries (started_at, ended_at);
    `)
  },
}
