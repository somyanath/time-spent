export interface LocalDayRange {
  /** Local calendar day, e.g. "2026-07-01". */
  dateKey: string
  startMs: number
  endMs: number
}

/** The local-timezone calendar day containing `now`, as a half-open [startMs, endMs) range. */
export function getLocalDayRange(now: number): LocalDayRange {
  const at = new Date(now)
  const start = new Date(at.getFullYear(), at.getMonth(), at.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    dateKey: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    startMs: start.getTime(),
    endMs: end.getTime(),
  }
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

/** Every local calendar day overlapping the half-open [startMs, endMs) range, midnight to midnight. */
export function iterateLocalDays(startMs: number, endMs: number): LocalDayRange[] {
  const days: LocalDayRange[] = []
  if (startMs >= endMs) return days

  let cursor = getLocalDayRange(startMs)
  while (cursor.startMs < endMs) {
    days.push(cursor)
    cursor = getLocalDayRange(cursor.endMs)
  }
  return days
}
