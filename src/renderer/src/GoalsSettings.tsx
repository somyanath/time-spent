import { useCallback, useEffect, useState } from 'react'
import type { GoalsConfig } from '../../shared/goals'

function msToMinutes(ms: number | null): string {
  return ms === null ? '' : String(Math.round(ms / 60_000))
}

function minutesToMs(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const minutes = Number(trimmed)
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return minutes * 60_000
}

const EMPTY_CONFIG: GoalsConfig = { focusTargetMs: null, overworkCeilingMs: null }

/**
 * Daily Goals (#27): a Focus target (aspirational — a progress indicator on
 * Today, one celebration notification when reached) and an Overwork ceiling
 * (protective — crossing it is the Burnout signal). Both are work-hours
 * active time and gated by Work Mode; leaving a field blank turns that goal,
 * and its notification, off entirely.
 */
export function GoalsSettings(): JSX.Element {
  const api = typeof window !== 'undefined' ? window.timeTracker : undefined

  const [config, setConfig] = useState<GoalsConfig>(EMPTY_CONFIG)

  const refresh = useCallback(async () => {
    if (!api) return
    setConfig(await api.getGoalsConfig())
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function persist(next: GoalsConfig): Promise<void> {
    if (!api) return
    setConfig(next)
    await api.setGoalsConfig(next)
  }

  return (
    <section className="settings__section" aria-labelledby="goals-heading">
      <h2 id="goals-heading" className="settings__section-title">
        Goals
      </h2>
      <p className="settings__section-hint">
        Both are work-hours active time and gated by Work Mode. Leave a field blank to turn that goal off.
      </p>

      <div className="settings__form">
        <label htmlFor="goals-focus-target">Focus target (minutes/day)</label>
        <input
          id="goals-focus-target"
          type="number"
          min={1}
          value={msToMinutes(config.focusTargetMs)}
          onChange={(e) => persist({ ...config, focusTargetMs: minutesToMs(e.target.value) })}
          aria-label="Daily Focus target in minutes"
        />
      </div>

      <div className="settings__form">
        <label htmlFor="goals-overwork-ceiling">Overwork ceiling (minutes/day)</label>
        <input
          id="goals-overwork-ceiling"
          type="number"
          min={1}
          value={msToMinutes(config.overworkCeilingMs)}
          onChange={(e) => persist({ ...config, overworkCeilingMs: minutesToMs(e.target.value) })}
          aria-label="Daily Overwork ceiling in minutes"
        />
      </div>
    </section>
  )
}
