import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCategory } from './categories'
import { insertHeartbeats } from './heartbeats'
import { migrations, runMigrations } from './migrations'
import { createProject } from './projects'
import { createRule } from './rules'
import { getTrends } from './trends'
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

const DAY_MS = 86_400_000
const MIN = 60_000
const ALL_DAY_RANGE = [{ startMinute: 0, endMinute: 24 * 60 }]
const ALL_DAY_WORKING_HOURS = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [day, ALL_DAY_RANGE]))

describe('getTrends', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
    setWorkingHours(db, ALL_DAY_WORKING_HOURS)
  })

  afterEach(() => {
    db.close()
  })

  it('returns one day entry per local calendar day in the range', () => {
    insertHeartbeats(db, [
      heartbeat({ startedAt: 0, endedAt: 10 * MIN, appName: 'Code' }),
      heartbeat({ startedAt: DAY_MS, endedAt: DAY_MS + 10 * MIN, appName: 'Code' }),
    ])

    const result = getTrends(db, { startMs: 0, endMs: 2 * DAY_MS, now: 2 * DAY_MS })

    expect(result.days).toHaveLength(2)
    expect(result.days[0].dateKey).toBe('1970-01-01')
    expect(result.days[1].dateKey).toBe('1970-01-02')
  })

  it('sums focus and distraction time per day from the daily rollup cache', () => {
    const focusCategory = createCategory(db, 'Code', 'focus')
    const distractingCategory = createCategory(db, 'Twitter', 'distracting')
    createRule(db, { categoryId: focusCategory.id, appPattern: 'Code' })
    createRule(db, { categoryId: distractingCategory.id, appPattern: 'Twitter' })
    insertHeartbeats(db, [
      heartbeat({ startedAt: 0, endedAt: 10 * MIN, appName: 'Code' }),
      heartbeat({ startedAt: 10 * MIN, endedAt: 15 * MIN, appName: 'Twitter' }),
    ])

    const result = getTrends(db, { startMs: 0, endMs: DAY_MS, now: 15 * MIN })

    expect(result.days[0].focusMs).toBe(10 * MIN)
    expect(result.days[0].focusMs).toBeGreaterThan(0)
    expect(result.days[0].distractionMs).toBe(5 * MIN)
    expect(result.totalFocusMs).toBe(10 * MIN)
    expect(result.totalDistractionMs).toBe(5 * MIN)
  })

  it('computes a per-day Focus Quality Score matching derive()', () => {
    const focusCategory = createCategory(db, 'Code', 'focus')
    createRule(db, { categoryId: focusCategory.id, appPattern: 'Code' })
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 20 * MIN, appName: 'Code' })])

    const result = getTrends(db, { startMs: 0, endMs: DAY_MS, now: 20 * MIN })

    expect(result.days[0].focusQualityScore).toBe(100)
  })

  it('breaks down top apps, categories, and projects across the whole range', () => {
    const codeCategory = createCategory(db, 'Code', 'focus')
    const project = createProject(db, 'Acme Website', null)
    createRule(db, { categoryId: codeCategory.id, projectId: project.id, appPattern: 'Code' })
    insertHeartbeats(db, [
      heartbeat({ startedAt: 0, endedAt: 10 * MIN, appName: 'Code' }),
      heartbeat({ startedAt: DAY_MS, endedAt: DAY_MS + 5 * MIN, appName: 'Code' }),
    ])

    const result = getTrends(db, { startMs: 0, endMs: 2 * DAY_MS, now: 2 * DAY_MS })

    expect(result.topApps).toEqual([{ key: 'Code', durationMs: 15 * MIN }])
    expect(result.topCategories).toEqual([{ key: 'Code', durationMs: 15 * MIN }])
    expect(result.topProjects).toEqual([{ key: 'Acme Website', durationMs: 15 * MIN }])
  })

  it('breaks down per-day project effort, grouping by Project', () => {
    const designCategory = createCategory(db, 'Design', 'focus')
    const project = createProject(db, 'Acme Website', 'Acme Corp')
    createRule(db, { categoryId: designCategory.id, projectId: project.id, appPattern: 'Figma' })
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 10 * MIN, appName: 'Figma' })])

    const result = getTrends(db, { startMs: 0, endMs: DAY_MS, now: 10 * MIN })

    expect(result.days[0].projectBreakdown).toEqual([{ key: 'Acme Website', durationMs: 10 * MIN }])
  })

  it('excludes unprojected time from topProjects and per-day projectBreakdown', () => {
    insertHeartbeats(db, [heartbeat({ startedAt: 0, endedAt: 10 * MIN, appName: 'Code' })])

    const result = getTrends(db, { startMs: 0, endMs: DAY_MS, now: 10 * MIN })

    expect(result.topProjects).toEqual([])
    expect(result.days[0].projectBreakdown).toEqual([])
  })
})
