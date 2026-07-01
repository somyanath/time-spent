import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDiscardedSpan, listDiscardedSpans } from './discardedSpans'
import { getDerivationVersion } from './derivationVersion'
import { migrations, runMigrations } from './migrations'

describe('discarded spans persistence', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('creates a discarded span and lists it', () => {
    createDiscardedSpan(db, { startedAt: 0, endedAt: 1_000 })

    const spans = listDiscardedSpans(db)

    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 1_000 })])
  })

  it('bumps the derivation version on create', () => {
    const before = getDerivationVersion(db)

    createDiscardedSpan(db, { startedAt: 0, endedAt: 1_000 })

    expect(getDerivationVersion(db)).toBe(before + 1)
  })
})
