import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCategory, deleteCategory, listCategories, updateCategory } from './categories'
import { getDerivationVersion } from './derivationVersion'
import { migrations, runMigrations } from './migrations'

describe('categories persistence', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('creates and lists categories alphabetically', () => {
    createCategory(db, 'Social Media', 'distracting')
    createCategory(db, 'Code', 'focus')

    expect(listCategories(db).map((c) => c.name)).toEqual(['Code', 'Social Media'])
  })

  it('bumps the derivation version on create, so cached rollups know to recompute', () => {
    const before = getDerivationVersion(db)

    createCategory(db, 'Code', 'focus')

    expect(getDerivationVersion(db)).toBe(before + 1)
  })

  it('updates a category name and rating', () => {
    const category = createCategory(db, 'Code', 'focus')

    updateCategory(db, category.id, { name: 'Coding', rating: 'neutral' })

    const [updated] = listCategories(db)
    expect(updated).toEqual({ id: category.id, name: 'Coding', rating: 'neutral' })
  })

  it('bumps the derivation version on update', () => {
    const category = createCategory(db, 'Code', 'focus')
    const before = getDerivationVersion(db)

    updateCategory(db, category.id, { rating: 'neutral' })

    expect(getDerivationVersion(db)).toBe(before + 1)
  })

  it('deletes a category', () => {
    const category = createCategory(db, 'Code', 'focus')

    deleteCategory(db, category.id)

    expect(listCategories(db)).toEqual([])
  })

  it('bumps the derivation version on delete', () => {
    const category = createCategory(db, 'Code', 'focus')
    const before = getDerivationVersion(db)

    deleteCategory(db, category.id)

    expect(getDerivationVersion(db)).toBe(before + 1)
  })
})
