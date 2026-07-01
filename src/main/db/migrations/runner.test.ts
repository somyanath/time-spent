import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from './runner'
import type { Migration } from './types'

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name)
  return row !== undefined
}

function userVersion(db: Database.Database): number {
  return db.pragma('user_version', { simple: true }) as number
}

describe('runMigrations', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  const createFoo: Migration = {
    version: 1,
    name: 'create_foo',
    up: (d) => d.exec('CREATE TABLE foo (id INTEGER PRIMARY KEY)'),
  }
  const createBar: Migration = {
    version: 2,
    name: 'create_bar',
    up: (d) => d.exec('CREATE TABLE bar (id INTEGER PRIMARY KEY)'),
  }

  it('applies all migrations on a fresh database in version order', () => {
    const result = runMigrations(db, [createFoo, createBar])

    expect(result.appliedVersions).toEqual([1, 2])
    expect(result.currentVersion).toBe(2)
    expect(tableExists(db, 'foo')).toBe(true)
    expect(tableExists(db, 'bar')).toBe(true)
    expect(userVersion(db)).toBe(2)
  })

  it('sorts migrations by version regardless of input order', () => {
    const applied: number[] = []
    const a: Migration = { version: 1, name: 'a', up: () => applied.push(1) }
    const b: Migration = { version: 2, name: 'b', up: () => applied.push(2) }
    const c: Migration = { version: 3, name: 'c', up: () => applied.push(3) }

    runMigrations(db, [c, a, b])

    expect(applied).toEqual([1, 2, 3])
  })

  it('is idempotent across relaunches (a second run applies nothing)', () => {
    runMigrations(db, [createFoo, createBar])
    const second = runMigrations(db, [createFoo, createBar])

    expect(second.appliedVersions).toEqual([])
    expect(second.currentVersion).toBe(2)
    expect(tableExists(db, 'foo')).toBe(true)
    expect(tableExists(db, 'bar')).toBe(true)
  })

  it('applies only migrations newer than the stored version', () => {
    runMigrations(db, [createFoo])
    expect(userVersion(db)).toBe(1)

    const result = runMigrations(db, [createFoo, createBar])

    expect(result.appliedVersions).toEqual([2])
    expect(result.currentVersion).toBe(2)
    expect(tableExists(db, 'bar')).toBe(true)
  })

  it('applies nothing (and does not fail) for an empty migration list', () => {
    const result = runMigrations(db, [])

    expect(result.appliedVersions).toEqual([])
    expect(result.currentVersion).toBe(0)
  })

  it('rejects duplicate version numbers', () => {
    const dupe: Migration = { version: 1, name: 'dupe', up: () => {} }

    expect(() => runMigrations(db, [createFoo, dupe])).toThrow(/duplicate/i)
  })

  it('rejects non-positive version numbers', () => {
    const zero: Migration = { version: 0, name: 'zero', up: () => {} }

    expect(() => runMigrations(db, [zero])).toThrow(/positive/i)
  })

  it('rolls back the entire run and leaves user_version untouched if a migration throws', () => {
    const boom: Migration = {
      version: 2,
      name: 'boom',
      up: () => {
        throw new Error('migration exploded')
      },
    }

    expect(() => runMigrations(db, [createFoo, boom])).toThrow(/exploded/)

    // Whole run is atomic: foo (applied earlier in the same run) is rolled back too.
    expect(tableExists(db, 'foo')).toBe(false)
    expect(userVersion(db)).toBe(0)
  })
})
