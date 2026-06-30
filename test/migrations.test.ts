import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'
import { runMigrations, type Migration } from '../src/main/db/migrations'

describe('runMigrations', () => {
  let db: DB

  beforeEach(() => {
    db = new Database(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  function appliedVersions(database: DB): number[] {
    return database
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all()
      .map((r) => (r as { version: number }).version)
  }

  it('starts at version 0 with no migrations and creates the bookkeeping table', () => {
    const result = runMigrations(db, [])
    expect(result.currentVersion).toBe(0)
    expect(result.appliedVersions).toEqual([])

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
      .get()
    expect(table).toBeTruthy()
  })

  it('applies pending migrations in version order', () => {
    const migrations: Migration[] = [
      {
        version: 1,
        name: 'create_widgets',
        up: (d) => d.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY)')
      },
      {
        version: 2,
        name: 'add_widget_label',
        up: (d) => d.exec('ALTER TABLE widgets ADD COLUMN label TEXT')
      }
    ]

    const result = runMigrations(db, migrations)

    expect(result.currentVersion).toBe(2)
    expect(result.appliedVersions).toEqual([1, 2])
    expect(appliedVersions(db)).toEqual([1, 2])

    // The migration actually ran: the column exists.
    const cols = db.prepare('PRAGMA table_info(widgets)').all() as { name: string }[]
    expect(cols.map((c) => c.name)).toContain('label')
  })

  it('is idempotent across relaunches — a second run applies nothing', () => {
    const migrations: Migration[] = [
      {
        version: 1,
        name: 'create_widgets',
        up: (d) => d.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY)')
      }
    ]

    runMigrations(db, migrations)
    const second = runMigrations(db, migrations)

    expect(second.appliedVersions).toEqual([])
    expect(second.currentVersion).toBe(1)
  })

  it('applies only newly-added migrations on a later run', () => {
    const v1: Migration = {
      version: 1,
      name: 'create_widgets',
      up: (d) => d.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY)')
    }
    runMigrations(db, [v1])

    const v2: Migration = {
      version: 2,
      name: 'create_gadgets',
      up: (d) => d.exec('CREATE TABLE gadgets (id INTEGER PRIMARY KEY)')
    }
    const result = runMigrations(db, [v1, v2])

    expect(result.appliedVersions).toEqual([2])
    expect(result.currentVersion).toBe(2)
  })

  it('rolls back a failing migration atomically and leaves prior migrations intact', () => {
    const migrations: Migration[] = [
      {
        version: 1,
        name: 'create_widgets',
        up: (d) => d.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY)')
      },
      {
        version: 2,
        name: 'broken',
        up: (d) => d.exec('THIS IS NOT VALID SQL')
      }
    ]

    expect(() => runMigrations(db, migrations)).toThrow()

    // v1 stays applied; v2 did not partially commit.
    expect(appliedVersions(db)).toEqual([1])
  })

  it('rejects duplicate version numbers', () => {
    const migrations: Migration[] = [
      { version: 1, name: 'a', up: () => {} },
      { version: 1, name: 'b', up: () => {} }
    ]
    expect(() => runMigrations(db, migrations)).toThrow(/duplicate/i)
  })

  it('accepts migrations supplied out of order and applies them in version order', () => {
    const order: number[] = []
    const migrations: Migration[] = [
      { version: 2, name: 'second', up: () => order.push(2) },
      { version: 1, name: 'first', up: () => order.push(1) }
    ]

    const result = runMigrations(db, migrations)

    expect(order).toEqual([1, 2])
    expect(result.appliedVersions).toEqual([1, 2])
  })
})
