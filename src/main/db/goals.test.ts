import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getGoalsConfig, setGoalsConfig } from './goals'
import { migrations, runMigrations } from './migrations'

describe('goals config persistence', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('defaults both goals to unset', () => {
    expect(getGoalsConfig(db)).toEqual({ focusTargetMs: null, overworkCeilingMs: null })
  })

  it('stores the Focus target and Overwork ceiling', () => {
    setGoalsConfig(db, { focusTargetMs: 4 * 60 * 60_000, overworkCeilingMs: 10 * 60 * 60_000 })

    expect(getGoalsConfig(db)).toEqual({ focusTargetMs: 4 * 60 * 60_000, overworkCeilingMs: 10 * 60 * 60_000 })
  })

  it('clears a goal back to unset', () => {
    setGoalsConfig(db, { focusTargetMs: 4 * 60 * 60_000, overworkCeilingMs: 10 * 60 * 60_000 })

    setGoalsConfig(db, { focusTargetMs: null, overworkCeilingMs: 10 * 60 * 60_000 })

    expect(getGoalsConfig(db)).toEqual({ focusTargetMs: null, overworkCeilingMs: 10 * 60 * 60_000 })
  })
})
