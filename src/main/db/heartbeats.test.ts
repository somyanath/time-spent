import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getHeartbeatsForRange, insertHeartbeats } from './heartbeats'
import { migrations, runMigrations } from './migrations'
import type { Heartbeat } from '../../shared/heartbeat'

function heartbeat(overrides: Partial<Heartbeat>): Heartbeat {
  return {
    startedAt: 0,
    endedAt: 1_000,
    appName: 'Code',
    bundleId: 'com.microsoft.VSCode',
    windowTitle: null,
    url: null,
    idleSeconds: 0,
    ...overrides,
  }
}

describe('heartbeats persistence', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('does nothing for an empty batch', () => {
    insertHeartbeats(db, [])

    const count = db.prepare('SELECT COUNT(*) as count FROM heartbeats').get() as { count: number }
    expect(count.count).toBe(0)
  })

  it('inserts a batch of heartbeats in one transaction and reads them back in order', () => {
    insertHeartbeats(db, [
      heartbeat({ startedAt: 10_000, endedAt: 13_000, appName: 'Slack' }),
      heartbeat({ startedAt: 0, endedAt: 3_000, appName: 'Code' }),
    ])

    const rows = getHeartbeatsForRange(db, 0, 20_000)

    expect(rows).toEqual([
      expect.objectContaining({ startedAt: 0, appName: 'Code' }),
      expect.objectContaining({ startedAt: 10_000, appName: 'Slack' }),
    ])
  })

  it('only returns heartbeats overlapping the requested range', () => {
    insertHeartbeats(db, [
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
      heartbeat({ startedAt: 100_000, endedAt: 103_000 }),
    ])

    const rows = getHeartbeatsForRange(db, 50_000, 150_000)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(expect.objectContaining({ startedAt: 100_000 }))
  })

  it('round-trips null window_title, url, and bundle_id', () => {
    insertHeartbeats(db, [heartbeat({ bundleId: null, windowTitle: null, url: null })])

    const [row] = getHeartbeatsForRange(db, 0, 10_000)

    expect(row.bundleId).toBeNull()
    expect(row.windowTitle).toBeNull()
    expect(row.url).toBeNull()
  })
})
