import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getOrComputeDailyRollup } from './dailyRollup'
import { insertHeartbeats } from './heartbeats'
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

describe('getOrComputeDailyRollup', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('computes and caches spans derived from raw heartbeats', () => {
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 3_000 })])

    const spans = getOrComputeDailyRollup(db, { dateKey: '2026-07-01', startMs: 0, endMs: 86_400_000, now: 3_000 })

    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 3_000, appName: 'Code' })])

    const row = db.prepare('SELECT * FROM daily_rollup WHERE date = ?').get('2026-07-01')
    expect(row).toBeDefined()
  })

  it('serves the cached row (never a replacement for raw) when the heartbeat count is unchanged', () => {
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 3_000 })])
    getOrComputeDailyRollup(db, { dateKey: '2026-07-01', startMs: 0, endMs: 86_400_000, now: 3_000 })
    const cachedAfterFirst = db.prepare('SELECT computed_at FROM daily_rollup WHERE date = ?').get('2026-07-01') as {
      computed_at: number
    }

    const spans = getOrComputeDailyRollup(db, {
      dateKey: '2026-07-01',
      startMs: 0,
      endMs: 86_400_000,
      now: 999_999,
    })

    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 3_000 })])
    const cachedAfterSecond = db.prepare('SELECT computed_at FROM daily_rollup WHERE date = ?').get('2026-07-01') as {
      computed_at: number
    }
    // Untouched: the cache was served, not recomputed.
    expect(cachedAfterSecond.computed_at).toBe(cachedAfterFirst.computed_at)
  })

  it('recomputes when new heartbeats have arrived since the row was cached', () => {
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 3_000 })])
    getOrComputeDailyRollup(db, { dateKey: '2026-07-01', startMs: 0, endMs: 86_400_000, now: 3_000 })

    insertHeartbeats(db, [heartbeat({ startedAt: 10_000, endedAt: 13_000, appName: 'Slack' })])
    const spans = getOrComputeDailyRollup(db, { dateKey: '2026-07-01', startMs: 0, endMs: 86_400_000, now: 13_000 })

    expect(spans).toHaveLength(2)
    expect(spans.map((s) => s.appName)).toEqual(['Code', 'Slack'])
  })

  it('is always re-derivable from raw: deleting the cached row recomputes identically', () => {
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 3_000 })])
    const first = getOrComputeDailyRollup(db, { dateKey: '2026-07-01', startMs: 0, endMs: 86_400_000, now: 3_000 })

    db.prepare('DELETE FROM daily_rollup WHERE date = ?').run('2026-07-01')
    const second = getOrComputeDailyRollup(db, { dateKey: '2026-07-01', startMs: 0, endMs: 86_400_000, now: 3_000 })

    expect(second).toEqual(first)
  })

  it('keeps separate rollups per day', () => {
    insertHeartbeats(db, [
      heartbeat({ startedAt: 0, endedAt: 3_000, appName: 'Code' }),
      heartbeat({ startedAt: 90_000_000, endedAt: 90_003_000, appName: 'Slack' }),
    ])

    const day1 = getOrComputeDailyRollup(db, { dateKey: '2026-07-01', startMs: 0, endMs: 86_400_000, now: 3_000 })
    const day2 = getOrComputeDailyRollup(db, {
      dateKey: '2026-07-02',
      startMs: 86_400_000,
      endMs: 172_800_000,
      now: 90_003_000,
    })

    expect(day1).toEqual([expect.objectContaining({ appName: 'Code' })])
    expect(day2).toEqual([expect.objectContaining({ appName: 'Slack' })])
  })
})
