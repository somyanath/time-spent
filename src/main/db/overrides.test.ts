import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCategory } from './categories'
import { getDerivationVersion } from './derivationVersion'
import { migrations, runMigrations } from './migrations'
import { createOverride, deleteOverride, listOverrides } from './overrides'
import { createProject, deleteProject } from './projects'

describe('overrides persistence', () => {
  let db: Database.Database
  let categoryId: number

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
    categoryId = createCategory(db, 'Code', 'focus').id
  })

  afterEach(() => {
    db.close()
  })

  it('creates an override and lists it', () => {
    createOverride(db, { startedAt: 0, endedAt: 1_000, categoryId })

    const overrides = listOverrides(db)

    expect(overrides).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 1_000, categoryId, projectId: null })])
  })

  it('defaults projectId to null when not given', () => {
    const override = createOverride(db, { startedAt: 0, endedAt: 1_000, categoryId })

    expect(override.projectId).toBeNull()
  })

  it('creates an override that assigns a project independently of its category', () => {
    const projectId = createProject(db, 'Acme Website').id

    const override = createOverride(db, { startedAt: 0, endedAt: 1_000, categoryId, projectId })

    expect(override).toEqual(expect.objectContaining({ categoryId, projectId }))
  })

  it('un-assigns a deleted project from overrides that reference it, without deleting the override', () => {
    const projectId = createProject(db, 'Acme Website').id
    const override = createOverride(db, { startedAt: 0, endedAt: 1_000, categoryId, projectId })

    deleteProject(db, projectId)

    const [persisted] = listOverrides(db)
    expect(persisted.id).toBe(override.id)
    expect(persisted.projectId).toBeNull()
  })

  it('bumps the derivation version on create', () => {
    const before = getDerivationVersion(db)

    createOverride(db, { startedAt: 0, endedAt: 1_000, categoryId })

    expect(getDerivationVersion(db)).toBe(before + 1)
  })

  it('deletes an override', () => {
    const override = createOverride(db, { startedAt: 0, endedAt: 1_000, categoryId })

    deleteOverride(db, override.id)

    expect(listOverrides(db)).toEqual([])
  })

  it('bumps the derivation version on delete', () => {
    const override = createOverride(db, { startedAt: 0, endedAt: 1_000, categoryId })
    const before = getDerivationVersion(db)

    deleteOverride(db, override.id)

    expect(getDerivationVersion(db)).toBe(before + 1)
  })
})
