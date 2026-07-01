import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrations, runMigrations } from './migrations'
import {
  clearWorkModeOverride,
  getWorkingHours,
  getWorkModeOverride,
  getWorkModeState,
  setWorkingHours,
  setWorkModeOverride,
} from './workMode'

describe('Work Mode persistence (#24)', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('defaults the Working Hours schedule to empty', () => {
    expect(getWorkingHours(db)).toEqual({})
  })

  it('round-trips a Working Hours schedule', () => {
    const schedule = {
      1: [{ startMinute: 9 * 60, endMinute: 17 * 60 }],
      2: [
        { startMinute: 9 * 60, endMinute: 12 * 60 },
        { startMinute: 13 * 60, endMinute: 17 * 60 },
      ],
    }

    setWorkingHours(db, schedule)

    expect(getWorkingHours(db)).toEqual(schedule)
  })

  it('replaces the whole schedule on a subsequent write ("copy to all days")', () => {
    setWorkingHours(db, { 1: [{ startMinute: 0, endMinute: 60 }] })

    setWorkingHours(db, { 1: [{ startMinute: 540, endMinute: 1020 }], 2: [{ startMinute: 540, endMinute: 1020 }] })

    expect(getWorkingHours(db)).toEqual({
      1: [{ startMinute: 540, endMinute: 1020 }],
      2: [{ startMinute: 540, endMinute: 1020 }],
    })
  })

  it('defaults the manual Work Mode override to unset', () => {
    expect(getWorkModeOverride(db)).toBeNull()
  })

  it('stores and reads back a manual Work Mode override', () => {
    setWorkModeOverride(db, true, 1_000)

    expect(getWorkModeOverride(db)).toEqual({ value: true, setAt: 1_000 })
  })

  it('clears a manual Work Mode override', () => {
    setWorkModeOverride(db, true, 1_000)

    clearWorkModeOverride(db)

    expect(getWorkModeOverride(db)).toBeNull()
  })

  it('computes the effective Work Mode state from the stored schedule and override', () => {
    setWorkingHours(db, { 1: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] })

    const duringHours = getWorkModeState(db, new Date(2026, 0, 5, 10).getTime())
    expect(duringHours.isOn).toBe(true)

    const outsideHours = getWorkModeState(db, new Date(2026, 0, 5, 18).getTime())
    expect(outsideHours.isOn).toBe(false)

    setWorkModeOverride(db, true, new Date(2026, 0, 5, 18).getTime())
    const overridden = getWorkModeState(db, new Date(2026, 0, 5, 18, 30).getTime())
    expect(overridden.isOn).toBe(true)
    expect(overridden.overridden).toBe(true)
  })
})
