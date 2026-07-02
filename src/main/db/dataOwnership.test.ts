import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCategory } from './categories'
import { deleteAllData, exportDailyRollupsCsv, exportSpansCsv } from './dataOwnership'
import { getOrComputeDailyRollup } from './dailyRollup'
import { insertHeartbeats } from './heartbeats'
import { migrations, runMigrations } from './migrations'
import { createRule } from './rules'
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

describe('exportSpansCsv', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('returns just the header when there are no heartbeats', () => {
    const csv = exportSpansCsv(db, { now: 3_000 })

    expect(csv).toBe('startedAt,endedAt,appName,windowTitle,url,category,rating,project')
  })

  it('emits one row per derived Span, categorized with the current Rules', () => {
    const categoryId = createCategory(db, 'Code', 'focus').id
    createRule(db, { categoryId, appPattern: 'Code' })
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 3_000, appName: 'Code' })])

    const csv = exportSpansCsv(db, { now: 3_000 })
    const lines = csv.split('\n')

    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe(
      `${new Date(0).toISOString()},${new Date(3_000).toISOString()},Code,,,Code,focus,`,
    )
  })

  it('quotes values containing commas', () => {
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 3_000, windowTitle: 'a, b' })])

    const csv = exportSpansCsv(db, { now: 3_000 })

    expect(csv).toContain('"a, b"')
  })
})

describe('exportDailyRollupsCsv', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('returns just the header when there are no heartbeats', () => {
    const csv = exportDailyRollupsCsv(db, { now: 3_000 })

    expect(csv).toBe('date,focusMs,distractionMs,focusQualityScore')
  })

  it('emits one row per local calendar day covered by the ledger', () => {
    const categoryId = createCategory(db, 'Code', 'focus').id
    createRule(db, { categoryId, appPattern: 'Code' })
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 3_000, appName: 'Code' })])

    const csv = exportDailyRollupsCsv(db, { now: 3_000 })
    const lines = csv.split('\n')

    expect(lines).toHaveLength(2)
    expect(lines[1].startsWith('1970-01-01,3000,0,')).toBe(true)
  })
})

describe('deleteAllData', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('clears the Heartbeat ledger and everything derived from it', () => {
    const categoryId = createCategory(db, 'Code', 'focus').id
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 3_000, appName: 'Code' })])
    getOrComputeDailyRollup(db, { dateKey: '1970-01-01', startMs: 0, endMs: 86_400_000, now: 3_000 })

    deleteAllData(db)

    expect(db.prepare('SELECT COUNT(*) AS count FROM heartbeats').get()).toEqual({ count: 0 })
    expect(db.prepare('SELECT COUNT(*) AS count FROM daily_rollup').get()).toEqual({ count: 0 })
    // Configuration (Categories/Rules/Projects/Settings) is not tracked activity data — it survives.
    expect(db.prepare('SELECT COUNT(*) AS count FROM categories').get()).toEqual({ count: 1 })
    expect(categoryId).toBeGreaterThan(0)
  })
})
