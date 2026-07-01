import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCategory } from './categories'
import { getDerivationVersion } from './derivationVersion'
import { migrations, runMigrations } from './migrations'
import { createProject, deleteProject } from './projects'
import { createRule, deleteRule, listRules, reorderRules } from './rules'

describe('rules persistence', () => {
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

  it('creates rules and lists them in position order', () => {
    createRule(db, { categoryId, appPattern: 'Code' })
    createRule(db, { categoryId, appPattern: 'Terminal' })

    const rules = listRules(db)

    expect(rules.map((r) => r.appPattern)).toEqual(['Code', 'Terminal'])
    expect(rules.map((r) => r.position)).toEqual([0, 1])
  })

  it('defaults unset patterns to null', () => {
    const rule = createRule(db, { categoryId, appPattern: 'Code' })

    expect(rule).toEqual(
      expect.objectContaining({ appPattern: 'Code', titlePattern: null, urlPattern: null }),
    )
  })

  it('defaults projectId to null when not given', () => {
    const rule = createRule(db, { categoryId, appPattern: 'Code' })

    expect(rule.projectId).toBeNull()
  })

  it('creates a rule that assigns a project independently of its category', () => {
    const projectId = createProject(db, 'Acme Website').id

    const rule = createRule(db, { categoryId, projectId, appPattern: 'Figma' })

    expect(rule).toEqual(expect.objectContaining({ categoryId, projectId }))
  })

  it('un-assigns a deleted project from rules that reference it, without deleting the rule', () => {
    const projectId = createProject(db, 'Acme Website').id
    const rule = createRule(db, { categoryId, projectId, appPattern: 'Figma' })

    deleteProject(db, projectId)

    const [persisted] = listRules(db)
    expect(persisted.id).toBe(rule.id)
    expect(persisted.projectId).toBeNull()
  })

  it('bumps the derivation version on create', () => {
    const before = getDerivationVersion(db)

    createRule(db, { categoryId, appPattern: 'Code' })

    expect(getDerivationVersion(db)).toBe(before + 1)
  })

  it('reorders rules to match the given id order', () => {
    const first = createRule(db, { categoryId, appPattern: 'Code' })
    const second = createRule(db, { categoryId, appPattern: 'Terminal' })

    reorderRules(db, [second.id, first.id])

    const rules = listRules(db)
    expect(rules.map((r) => r.id)).toEqual([second.id, first.id])
    expect(rules.map((r) => r.position)).toEqual([0, 1])
  })

  it('bumps the derivation version on reorder', () => {
    const first = createRule(db, { categoryId, appPattern: 'Code' })
    const second = createRule(db, { categoryId, appPattern: 'Terminal' })
    const before = getDerivationVersion(db)

    reorderRules(db, [second.id, first.id])

    expect(getDerivationVersion(db)).toBe(before + 1)
  })

  it('deletes a rule', () => {
    const rule = createRule(db, { categoryId, appPattern: 'Code' })

    deleteRule(db, rule.id)

    expect(listRules(db)).toEqual([])
  })

  it('bumps the derivation version on delete', () => {
    const rule = createRule(db, { categoryId, appPattern: 'Code' })
    const before = getDerivationVersion(db)

    deleteRule(db, rule.id)

    expect(getDerivationVersion(db)).toBe(before + 1)
  })
})
