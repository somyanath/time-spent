/** One working-hours range within a single weekday, in minutes since local midnight (half-open: [startMinute, endMinute)). */
export interface WorkingHoursRange {
  startMinute: number
  endMinute: number
}

/** Per-weekday Working Hours, keyed by `Date#getDay()` (0 = Sunday .. 6 = Saturday). A day with no entry has no ranges. */
export type WorkingHoursSchedule = Partial<Record<number, readonly WorkingHoursRange[]>>

/**
 * A manual Work Mode toggle, self-healing (#24): it wins over the schedule
 * only until the next scheduled boundary after it was set, so the user can
 * never accidentally disable coaching permanently.
 */
export interface WorkModeOverride {
  value: boolean
  setAt: number
}

export interface WorkModeState {
  isOn: boolean
  /** True when a still-active manual override, rather than the schedule, determined `isOn`. */
  overridden: boolean
  /** The next timestamp the schedule-derived state changes; null if the schedule never changes (no ranges at all). */
  nextChangeAt: number | null
}

const MINUTES_PER_DAY = 24 * 60
const DAYS_TO_SEARCH = 7

/**
 * Computes Work Mode (#24): the per-weekday Working Hours schedule gates
 * judgment features, with a manual override that expires at the next
 * scheduled boundary rather than persisting indefinitely.
 */
export function computeWorkModeState(
  schedule: WorkingHoursSchedule,
  override: WorkModeOverride | null,
  now: number,
): WorkModeState {
  const nextChangeAt = nextBoundaryAfter(schedule, now)

  if (override) {
    const overrideExpiry = nextBoundaryAfter(schedule, override.setAt)
    const overrideActive = overrideExpiry === null || now < overrideExpiry
    if (overrideActive) {
      return { isOn: override.value, overridden: true, nextChangeAt }
    }
  }

  return { isOn: scheduleIsOn(schedule, now), overridden: false, nextChangeAt }
}

function scheduleIsOn(schedule: WorkingHoursSchedule, at: number): boolean {
  const date = new Date(at)
  const ranges = schedule[date.getDay()] ?? []
  const minuteOfDay = date.getHours() * 60 + date.getMinutes()
  return ranges.some((range) => minuteOfDay >= range.startMinute && minuteOfDay < range.endMinute)
}

/**
 * Total milliseconds of `[startedAt, endedAt)` that fall inside the
 * schedule's Working Hours ranges. Ranges are minutes since each day's local
 * midnight, so an interval spanning multiple days is clipped day by day.
 * Used to work-hours-scope judgment metrics (e.g. the Focus Quality Score,
 * #25) without gating tracking itself.
 */
export function workingHoursOverlapMs(startedAt: number, endedAt: number, schedule: WorkingHoursSchedule): number {
  let total = 0
  let cursor = startedAt

  while (cursor < endedAt) {
    const dayStart = new Date(cursor)
    dayStart.setHours(0, 0, 0, 0)
    const dayStartMs = dayStart.getTime()
    const dayEndMs = dayStartMs + MINUTES_PER_DAY * 60_000
    const segmentEnd = Math.min(endedAt, dayEndMs)
    const ranges = schedule[dayStart.getDay()] ?? []

    for (const range of ranges) {
      const overlapStart = Math.max(cursor, dayStartMs + range.startMinute * 60_000)
      const overlapEnd = Math.min(segmentEnd, dayStartMs + range.endMinute * 60_000)
      if (overlapEnd > overlapStart) total += overlapEnd - overlapStart
    }

    cursor = segmentEnd
  }

  return total
}

/** The next timestamp after `at` where a range boundary falls, searching forward up to a full week. */
function nextBoundaryAfter(schedule: WorkingHoursSchedule, at: number): number | null {
  const dayStart = new Date(at)
  dayStart.setHours(0, 0, 0, 0)

  let best: number | null = null
  for (let dayOffset = 0; dayOffset <= DAYS_TO_SEARCH; dayOffset++) {
    const day = new Date(dayStart)
    day.setDate(day.getDate() + dayOffset)
    const ranges = schedule[day.getDay()] ?? []

    for (const range of ranges) {
      for (const minute of [range.startMinute, range.endMinute]) {
        if (minute < 0 || minute > MINUTES_PER_DAY) continue
        const candidate = day.getTime() + minute * 60_000
        if (candidate > at && (best === null || candidate < best)) {
          best = candidate
        }
      }
    }
  }

  return best
}
