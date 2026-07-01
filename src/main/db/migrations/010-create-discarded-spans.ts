import type { Migration } from './types'

/**
 * Discarded Spans: a stored time range excluded from all metrics. The
 * underlying Heartbeats are untouched — `derive()` matches a derived Span
 * against this table by time-range overlap and drops it from the result.
 */
export const createDiscardedSpans: Migration = {
  version: 10,
  name: 'create_discarded_spans',
  up: (db) => {
    db.exec(`
      CREATE TABLE discarded_spans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL
      );

      CREATE INDEX idx_discarded_spans_range ON discarded_spans (started_at, ended_at);
    `)
  },
}
