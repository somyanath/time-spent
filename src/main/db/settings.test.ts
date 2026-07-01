import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrations, runMigrations } from './migrations'
import { getSettings, setAppLevelOnly } from './settings'

describe('settings persistence', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('defaults App-level-only mode to off', () => {
    expect(getSettings(db)).toEqual({ appLevelOnly: false })
  })

  it('turns App-level-only mode on', () => {
    setAppLevelOnly(db, true)

    expect(getSettings(db)).toEqual({ appLevelOnly: true })
  })

  it('turns App-level-only mode back off', () => {
    setAppLevelOnly(db, true)

    setAppLevelOnly(db, false)

    expect(getSettings(db)).toEqual({ appLevelOnly: false })
  })
})
