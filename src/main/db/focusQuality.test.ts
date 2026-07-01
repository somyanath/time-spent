import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCategory } from './categories'
import { getFocusQuality } from './focusQuality'
import { insertHeartbeats } from './heartbeats'
import { migrations, runMigrations } from './migrations'
import { createRule } from './rules'
import { setWorkingHours } from './workMode'
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

const MIN = 60_000
const ALL_DAY_RANGE = [{ startMinute: 0, endMinute: 24 * 60 }]
const ALL_DAY_WORKING_HOURS = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [day, ALL_DAY_RANGE]))

describe('getFocusQuality', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('derives the score from the day range and stored categorization', () => {
    const category = createCategory(db, 'Code', 'focus')
    createRule(db, { categoryId: category.id, appPattern: 'Code' })
    setWorkingHours(db, ALL_DAY_WORKING_HOURS)
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 20 * MIN })])

    const result = getFocusQuality(db, { startMs: 0, endMs: 86_400_000, now: 20 * MIN })

    expect(result.breakdown.focusRatio).toBe(1)
    expect(result.breakdown.distractionPenalty).toBe(0)
    expect(result.score).toBeGreaterThan(0)
  })

  it('is 0 with no Working Hours configured, matching Work Mode being off by default', () => {
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 20 * MIN })])

    const result = getFocusQuality(db, { startMs: 0, endMs: 86_400_000, now: 20 * MIN })

    expect(result.score).toBe(0)
  })
})
