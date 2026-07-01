import type Database from 'better-sqlite3'
import { bumpDerivationVersion } from './derivationVersion'
import type { Category, ProductivityRating } from '../../shared/category'

export function listCategories(db: Database.Database): Category[] {
  return db.prepare('SELECT id, name, rating FROM categories ORDER BY name ASC').all() as Category[]
}

export function createCategory(db: Database.Database, name: string, rating: ProductivityRating): Category {
  let id = 0
  db.transaction(() => {
    const result = db.prepare('INSERT INTO categories (name, rating) VALUES (?, ?)').run(name, rating)
    id = result.lastInsertRowid as number
    bumpDerivationVersion(db)
  })()
  return { id, name, rating }
}

export function updateCategory(
  db: Database.Database,
  id: number,
  updates: { name?: string; rating?: ProductivityRating },
): void {
  db.transaction(() => {
    if (updates.name !== undefined) {
      db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(updates.name, id)
    }
    if (updates.rating !== undefined) {
      db.prepare('UPDATE categories SET rating = ? WHERE id = ?').run(updates.rating, id)
    }
    bumpDerivationVersion(db)
  })()
}

/** Deleting a Category cascades to its Rules (`ON DELETE CASCADE`), so those Rules stop matching. */
export function deleteCategory(db: Database.Database, id: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    bumpDerivationVersion(db)
  })()
}
