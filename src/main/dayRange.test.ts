import { describe, expect, it } from 'vitest'
import { getLocalDayRange, iterateLocalDays } from './dayRange'

describe('getLocalDayRange', () => {
  it('returns a half-open range spanning midnight to midnight', () => {
    const noon = new Date(2026, 6, 1, 12, 30, 0).getTime()

    const { dateKey, startMs, endMs } = getLocalDayRange(noon)

    expect(dateKey).toBe('2026-07-01')
    expect(startMs).toBe(new Date(2026, 6, 1, 0, 0, 0, 0).getTime())
    expect(endMs).toBe(new Date(2026, 6, 2, 0, 0, 0, 0).getTime())
  })

  it('pads single-digit months and days', () => {
    const { dateKey } = getLocalDayRange(new Date(2026, 0, 5, 9, 0, 0).getTime())

    expect(dateKey).toBe('2026-01-05')
  })

  it('treats a moment just before midnight as the earlier day', () => {
    const justBeforeMidnight = new Date(2026, 6, 1, 23, 59, 59, 999).getTime()

    const { dateKey } = getLocalDayRange(justBeforeMidnight)

    expect(dateKey).toBe('2026-07-01')
  })
})

describe('iterateLocalDays', () => {
  it('walks midnight-to-midnight local days covering the range', () => {
    const start = new Date(2026, 6, 1, 9, 0, 0).getTime()
    const end = new Date(2026, 6, 3, 17, 0, 0).getTime()

    const days = iterateLocalDays(start, end)

    expect(days.map((day) => day.dateKey)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
    expect(days[0].startMs).toBe(new Date(2026, 6, 1, 0, 0, 0, 0).getTime())
    expect(days[2].endMs).toBe(new Date(2026, 6, 4, 0, 0, 0, 0).getTime())
  })

  it('returns a single day when start and end fall on the same day', () => {
    const start = new Date(2026, 6, 1, 9, 0, 0).getTime()
    const end = new Date(2026, 6, 1, 17, 0, 0).getTime()

    const days = iterateLocalDays(start, end)

    expect(days.map((day) => day.dateKey)).toEqual(['2026-07-01'])
  })

  it('returns an empty array for an empty (start === end) range', () => {
    const at = new Date(2026, 6, 1, 9, 0, 0).getTime()

    expect(iterateLocalDays(at, at)).toEqual([])
  })
})
