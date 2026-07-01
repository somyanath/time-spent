import { useCallback, useEffect, useState } from 'react'
import type { WorkingHoursRange, WorkingHoursSchedule, WorkModeState } from '../../shared/workMode'

const WEEKDAYS: { id: number; label: string }[] = [
  { id: 0, label: 'Sunday' },
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
]

const DEFAULT_RANGE: WorkingHoursRange = { startMinute: 9 * 60, endMinute: 17 * 60 }

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')
  const mins = (minutes % 60).toString().padStart(2, '0')
  return `${hours}:${mins}`
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function formatClock(at: number): string {
  return new Date(at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

/**
 * The per-weekday Working Hours schedule (#24) `derive()` reads to compute
 * `workModeState`, plus the single manual override toggle that wins over
 * the schedule only until the next scheduled boundary. Tracking itself is
 * never gated by any of this — only judgment features (Nudge, Break
 * Reminder, Goals) read `workModeState`, in later slices.
 */
export function WorkingHoursSettings(): JSX.Element {
  const api = typeof window !== 'undefined' ? window.timeTracker : undefined

  const [schedule, setSchedule] = useState<WorkingHoursSchedule>({})
  const [workModeState, setWorkModeState] = useState<WorkModeState | null>(null)

  const refresh = useCallback(async () => {
    if (!api) return
    const [nextSchedule, nextState] = await Promise.all([api.getWorkingHours(), api.getWorkModeState()])
    setSchedule(nextSchedule)
    setWorkModeState(nextState)
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function persist(next: WorkingHoursSchedule): Promise<void> {
    if (!api) return
    setSchedule(next)
    await api.setWorkingHours(next)
    setWorkModeState(await api.getWorkModeState())
  }

  function handleAddRange(weekday: number): void {
    const ranges = schedule[weekday] ?? []
    persist({ ...schedule, [weekday]: [...ranges, { ...DEFAULT_RANGE }] })
  }

  function handleRemoveRange(weekday: number, index: number): void {
    const ranges = (schedule[weekday] ?? []).filter((_, i) => i !== index)
    persist({ ...schedule, [weekday]: ranges })
  }

  function handleRangeChange(weekday: number, index: number, field: keyof WorkingHoursRange, value: string): void {
    const ranges = (schedule[weekday] ?? []).map((range, i) =>
      i === index ? { ...range, [field]: timeToMinutes(value) } : range,
    )
    persist({ ...schedule, [weekday]: ranges })
  }

  function handleCopyToAllDays(weekday: number): void {
    const ranges = schedule[weekday] ?? []
    const next: WorkingHoursSchedule = {}
    for (const day of WEEKDAYS) {
      next[day.id] = ranges.map((range) => ({ ...range }))
    }
    persist(next)
  }

  async function handleForceOverride(value: boolean): Promise<void> {
    if (!api) return
    setWorkModeState(await api.setWorkModeOverride(value))
  }

  async function handleClearOverride(): Promise<void> {
    if (!api) return
    setWorkModeState(await api.clearWorkModeOverride())
  }

  return (
    <section className="settings__section" aria-labelledby="working-hours-heading">
      <h2 id="working-hours-heading" className="settings__section-title">
        Working Hours
      </h2>
      <p className="settings__section-hint">
        Work Mode turns on automatically during these hours and gates coaching (Nudges, Break Reminders, Goals) —
        tracking itself never stops, on or off the clock.
      </p>

      {workModeState && (
        <p className="settings__section-hint">
          Work Mode is currently <strong>{workModeState.isOn ? 'on' : 'off'}</strong>
          {workModeState.overridden && ' (manual override)'}
          {workModeState.nextChangeAt !== null && ` — next changes ${formatClock(workModeState.nextChangeAt)}`}
          .
        </p>
      )}

      <div className="settings__form">
        <button type="button" onClick={() => handleForceOverride(true)}>
          Force On
        </button>
        <button type="button" onClick={() => handleForceOverride(false)}>
          Force Off
        </button>
        {workModeState?.overridden && (
          <button type="button" onClick={handleClearOverride}>
            Clear Override
          </button>
        )}
      </div>

      <ul className="settings__list" aria-label="Working Hours by day">
        {WEEKDAYS.map((day) => (
          <li key={day.id} className="settings__list-item">
            <span className="settings__list-item-name">{day.label}</span>

            <div className="settings__form">
              {(schedule[day.id] ?? []).map((range, index) => (
                <span key={index}>
                  <input
                    type="time"
                    value={minutesToTime(range.startMinute)}
                    onChange={(e) => handleRangeChange(day.id, index, 'startMinute', e.target.value)}
                    aria-label={`${day.label} range ${index + 1} start`}
                  />
                  <input
                    type="time"
                    value={minutesToTime(range.endMinute)}
                    onChange={(e) => handleRangeChange(day.id, index, 'endMinute', e.target.value)}
                    aria-label={`${day.label} range ${index + 1} end`}
                  />
                  <button
                    type="button"
                    className="settings__delete"
                    onClick={() => handleRemoveRange(day.id, index)}
                    aria-label={`Remove ${day.label} range ${index + 1}`}
                  >
                    Remove
                  </button>
                </span>
              ))}
              <button type="button" onClick={() => handleAddRange(day.id)}>
                Add range
              </button>
              <button type="button" onClick={() => handleCopyToAllDays(day.id)}>
                Copy to all days
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
