import { describe, expect, it } from 'vitest'
import { computeWorkModeState } from './workMode'
import type { WorkingHoursSchedule } from './workMode'

// Mon Jan 5 2026 09:00 local time, and neighboring instants, used throughout.
const MONDAY = 1 // Date#getDay() for 2026-01-05

function at(day: number, hour: number, minute = 0): number {
  return new Date(2026, 0, day, hour, minute).getTime()
}

describe('computeWorkModeState', () => {
  it('is off with no schedule and no override', () => {
    const state = computeWorkModeState({}, null, at(5, 10))

    expect(state.isOn).toBe(false)
    expect(state.overridden).toBe(false)
    expect(state.nextChangeAt).toBeNull()
  })

  it('is on inside a scheduled range and off outside it', () => {
    const schedule: WorkingHoursSchedule = { [MONDAY]: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] }

    expect(computeWorkModeState(schedule, null, at(5, 8, 59)).isOn).toBe(false)
    expect(computeWorkModeState(schedule, null, at(5, 9, 0)).isOn).toBe(true)
    expect(computeWorkModeState(schedule, null, at(5, 16, 59)).isOn).toBe(true)
    expect(computeWorkModeState(schedule, null, at(5, 17, 0)).isOn).toBe(false)
  })

  it('handles multiple ranges in the same day independently', () => {
    const schedule: WorkingHoursSchedule = {
      [MONDAY]: [
        { startMinute: 9 * 60, endMinute: 12 * 60 },
        { startMinute: 13 * 60, endMinute: 17 * 60 },
      ],
    }

    expect(computeWorkModeState(schedule, null, at(5, 11, 30)).isOn).toBe(true)
    expect(computeWorkModeState(schedule, null, at(5, 12, 30)).isOn).toBe(false)
    expect(computeWorkModeState(schedule, null, at(5, 13, 30)).isOn).toBe(true)
  })

  it('treats each weekday independently', () => {
    const schedule: WorkingHoursSchedule = { [MONDAY]: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] }

    expect(computeWorkModeState(schedule, null, at(6, 10)).isOn).toBe(false)
  })

  it('reports the next scheduled boundary', () => {
    const schedule: WorkingHoursSchedule = { [MONDAY]: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] }

    expect(computeWorkModeState(schedule, null, at(5, 8)).nextChangeAt).toBe(at(5, 9))
    expect(computeWorkModeState(schedule, null, at(5, 10)).nextChangeAt).toBe(at(5, 17))
  })

  it('wraps the next boundary search across the week', () => {
    const schedule: WorkingHoursSchedule = { [MONDAY]: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] }

    // Monday evening: the next boundary is next Monday's 09:00 start.
    expect(computeWorkModeState(schedule, null, at(5, 18)).nextChangeAt).toBe(at(12, 9))
  })

  it('a manual override wins over the schedule until the next boundary', () => {
    const schedule: WorkingHoursSchedule = {
      [MONDAY]: [
        { startMinute: 9 * 60, endMinute: 17 * 60 },
        { startMinute: 22 * 60, endMinute: 23 * 60 },
      ],
    }
    // Off-hours (Monday 20:00), force Work Mode on — the next boundary is the 22:00 range start.
    const override = { value: true, setAt: at(5, 20) }

    const overridden = computeWorkModeState(schedule, override, at(5, 21))
    expect(overridden.isOn).toBe(true)
    expect(overridden.overridden).toBe(true)

    // Once the 22:00 boundary has passed, the override has expired and the schedule
    // resumes on its own — by 23:30 that means off again (the late range has ended).
    const afterExpiry = computeWorkModeState(schedule, override, at(5, 23, 30))
    expect(afterExpiry.isOn).toBe(false)
    expect(afterExpiry.overridden).toBe(false)
  })

  it('an override forcing off during a scheduled range expires at the range end', () => {
    const schedule: WorkingHoursSchedule = { [MONDAY]: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] }
    const override = { value: false, setAt: at(5, 10) }

    expect(computeWorkModeState(schedule, override, at(5, 12)).isOn).toBe(false)
    expect(computeWorkModeState(schedule, override, at(5, 12)).overridden).toBe(true)

    // After 17:00 the schedule itself says off, and the override has expired.
    const after = computeWorkModeState(schedule, override, at(5, 17, 1))
    expect(after.isOn).toBe(false)
    expect(after.overridden).toBe(false)
  })

  it('an override never expires against an entirely empty schedule', () => {
    const override = { value: true, setAt: at(5, 9) }

    const state = computeWorkModeState({}, override, at(20, 9))
    expect(state.isOn).toBe(true)
    expect(state.overridden).toBe(true)
  })
})
