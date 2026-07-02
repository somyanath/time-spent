import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCategory } from './categories'
import { getGoalProgress } from './goalProgress'
import { setGoalsConfig } from './goals'
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

describe('getGoalProgress', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('derives progress against the stored Focus target and Overwork ceiling', () => {
    const category = createCategory(db, 'Code', 'focus')
    createRule(db, { categoryId: category.id, appPattern: 'Code' })
    setWorkingHours(db, ALL_DAY_WORKING_HOURS)
    setGoalsConfig(db, { focusTargetMs: 60 * MIN, overworkCeilingMs: 90 * MIN })
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 50 * MIN })])

    const result = getGoalProgress(db, { startMs: 0, endMs: 86_400_000, now: 50 * MIN })

    expect(result).toEqual({
      focusAccumulatedMs: 50 * MIN,
      focusTargetMs: 60 * MIN,
      workActiveMs: 50 * MIN,
      overworkCeilingMs: 90 * MIN,
    })
  })

  it('leaves both targets null when no goal is configured', () => {
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 50 * MIN })])

    const result = getGoalProgress(db, { startMs: 0, endMs: 86_400_000, now: 50 * MIN })

    expect(result.focusTargetMs).toBeNull()
    expect(result.overworkCeilingMs).toBeNull()
  })
})
