import type { Migration } from './types'

/**
 * Rules: an ordered mapping from observed span facts (app/title/url pattern)
 * to a Category, applied at read time in `derive()` (ADR-0001). `position`
 * is the priority — ascending, lowest matched first — and is rewritten
 * wholesale on reorder rather than modeled as a linked list.
 */
export const createRules: Migration = {
  version: 4,
  name: 'create_rules',
  up: (db) => {
    db.exec(`
      CREATE TABLE rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        app_pattern TEXT,
        title_pattern TEXT,
        url_pattern TEXT
      );

      CREATE INDEX idx_rules_position ON rules (position);
    `)
  },
}
