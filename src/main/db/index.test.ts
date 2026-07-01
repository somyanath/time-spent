import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './index'

describe('openDatabase', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tt-db-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates the database (and its parent directory) under the given path', () => {
    // Nested, not-yet-existing dir mirrors ~/Library/Application Support/<app>/.
    const dbPath = join(dir, 'Application Support', 'time-tracker', 'timetracker.db')

    const { db, migration } = openDatabase(dbPath)

    expect(db.open).toBe(true)
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(migration.appliedVersions).toEqual([1, 2])
    expect(migration.currentVersion).toBe(2)
    db.close()
  })

  it('reopens the same file cleanly across relaunches (idempotent startup)', () => {
    const dbPath = join(dir, 'timetracker.db')

    const first = openDatabase(dbPath)
    first.db.exec('CREATE TABLE probe (id INTEGER PRIMARY KEY)')
    first.db.close()

    const second = openDatabase(dbPath)
    const probeStillThere = second.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='probe'`)
      .get()

    expect(probeStillThere).toBeDefined()
    expect(second.migration.appliedVersions).toEqual([])
    second.db.close()
  })
})
