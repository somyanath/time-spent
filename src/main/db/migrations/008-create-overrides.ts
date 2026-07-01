import type { Migration } from './types'

/**
 * Overrides: a stored, sticky assertion that a time range should carry a
 * given Category and, optionally, Project — regardless of what the Rules
 * layer computes (ADR-0001). Matched to a derived Span by time-range
 * overlap in `derive()`, so it keeps winning across later Rule edits.
 */
export const createOverrides: Migration = {
  version: 8,
  name: 'create_overrides',
  up: (db) => {
    db.exec(`
      CREATE TABLE overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_overrides_range ON overrides (started_at, ended_at);
    `)
  },
}
