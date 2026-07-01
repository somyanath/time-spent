import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCategory } from './categories'
import { getDerivationVersion } from './derivationVersion'
import { createManualEntry, deleteManualEntry, listManualEntries } from './manualEntries'
import { migrations, runMigrations } from './migrations'
import { createProject, deleteProject } from './projects'

describe('manual entries persistence', () => {
  let db: Database.Database
  let categoryId: number

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
    categoryId = createCategory(db, 'Meetings', 'neutral').id
  })

  afterEach(() => {
    db.close()
  })

  it('creates a manual entry and lists it', () => {
    createManualEntry(db, { startedAt: 0, endedAt: 1_000, label: 'Client call', categoryId })

    const entries = listManualEntries(db)

    expect(entries).toEqual([
      expect.objectContaining({ startedAt: 0, endedAt: 1_000, label: 'Client call', categoryId, projectId: null }),
    ])
  })

  it('defaults projectId to null when not given', () => {
    const entry = createManualEntry(db, { startedAt: 0, endedAt: 1_000, label: 'Client call', categoryId })

    expect(entry.projectId).toBeNull()
  })

  it('creates a manual entry that assigns a project independently of its category', () => {
    const projectId = createProject(db, 'Acme Website').id

    const entry = createManualEntry(db, { startedAt: 0, endedAt: 1_000, label: 'Client call', categoryId, projectId })

    expect(entry).toEqual(expect.objectContaining({ categoryId, projectId }))
  })

  it('un-assigns a deleted project from manual entries that reference it, without deleting the entry', () => {
    const projectId = createProject(db, 'Acme Website').id
    const entry = createManualEntry(db, { startedAt: 0, endedAt: 1_000, label: 'Client call', categoryId, projectId })

    deleteProject(db, projectId)

    const [persisted] = listManualEntries(db)
    expect(persisted.id).toBe(entry.id)
    expect(persisted.projectId).toBeNull()
  })

  it('bumps the derivation version on create', () => {
    const before = getDerivationVersion(db)

    createManualEntry(db, { startedAt: 0, endedAt: 1_000, label: 'Client call', categoryId })

    expect(getDerivationVersion(db)).toBe(before + 1)
  })

  it('deletes a manual entry', () => {
    const entry = createManualEntry(db, { startedAt: 0, endedAt: 1_000, label: 'Client call', categoryId })

    deleteManualEntry(db, entry.id)

    expect(listManualEntries(db)).toEqual([])
  })

  it('bumps the derivation version on delete', () => {
    const entry = createManualEntry(db, { startedAt: 0, endedAt: 1_000, label: 'Client call', categoryId })
    const before = getDerivationVersion(db)

    deleteManualEntry(db, entry.id)

    expect(getDerivationVersion(db)).toBe(before + 1)
  })
})
