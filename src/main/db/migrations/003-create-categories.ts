import type { Migration } from './types'

/**
 * Categories: a label for what kind of activity a span represents, carrying
 * a three-way Productivity Rating (CONTEXT.md). Orthogonal to Project (#19).
 */
export const createCategories: Migration = {
  version: 3,
  name: 'create_categories',
  up: (db) => {
    db.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        rating TEXT NOT NULL CHECK (rating IN ('focus', 'neutral', 'distracting'))
      );
    `)
  },
}
