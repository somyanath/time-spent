import { useEffect, useState } from 'react'
import type { TrendsResult } from '../../shared/trends'

const RANGE_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

/**
 * Trends (#28): the longer-pattern surface alongside Today. Shows focus
 * time, the Focus Quality Score, distraction, and top apps/categories/
 * projects over a selectable range, reading from the daily rollup cache
 * (via `getTrends`) so it stays responsive over months of history. Grouping
 * by Project covers the deferred per-project report — swapping the daily
 * breakdown and the "top" list from Category to Project.
 */
export function Trends(): JSX.Element {
  const api = typeof window !== 'undefined' ? window.timeTracker : undefined

  const [rangeDays, setRangeDays] = useState(7)
  const [groupByProject, setGroupByProject] = useState(false)
  const [trends, setTrends] = useState<TrendsResult | null>(null)

  useEffect(() => {
    if (!api) return
    const { startMs, endMs } = getRangeMs(rangeDays)
    api.getTrends({ startMs, endMs }).then(setTrends)
  }, [api, rangeDays])

  const topBreakdown = trends ? (groupByProject ? trends.topProjects : trends.topCategories) : []

  return (
    <section className="trends" aria-labelledby="trends-heading">
      <header className="trends__header">
        <h1 id="trends-heading" className="trends__title">
          Trends
        </h1>
        <div className="trends__controls">
          <div className="trends__range" role="group" aria-label="Time range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                className={`trends__range-button${rangeDays === option.days ? ' trends__range-button--active' : ''}`}
                aria-pressed={rangeDays === option.days}
                onClick={() => setRangeDays(option.days)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="settings__toggle">
            <input
              type="checkbox"
              checked={groupByProject}
              onChange={(e) => setGroupByProject(e.target.checked)}
            />
            Group by Project
          </label>
        </div>
      </header>

      {trends && trends.days.length > 0 ? (
        <>
          <section className="trends__summary" aria-label="Range summary">
            <div className="trends__summary-item">
              <span className="trends__summary-label">Focus time</span>
              <span className="trends__summary-value">{formatDuration(trends.totalFocusMs)}</span>
            </div>
            <div className="trends__summary-item">
              <span className="trends__summary-label">Distraction time</span>
              <span className="trends__summary-value">{formatDuration(trends.totalDistractionMs)}</span>
            </div>
          </section>

          <ol className="trends__days" aria-label="Daily breakdown">
            {trends.days.map((day) => {
              const breakdown = groupByProject ? day.projectBreakdown : day.categoryBreakdown
              return (
                <li key={day.dateKey} className="trends__day">
                  <div className="trends__day-row">
                    <span className="trends__day-date">{formatDateKey(day.dateKey)}</span>
                    <span className="trends__day-score">{day.focusQualityScore}</span>
                    <span className="trends__day-focus">{formatDuration(day.focusMs)} focus</span>
                    <span className="trends__day-distraction">{formatDuration(day.distractionMs)} distraction</span>
                  </div>
                  {breakdown.length > 0 && (
                    <ul className="trends__day-breakdown">
                      {breakdown.slice(0, 3).map((entry) => (
                        <li key={entry.key} className="trends__day-breakdown-item">
                          {entry.key} · {formatDuration(entry.durationMs)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>

          <section className="trends__top" aria-label={groupByProject ? 'Top projects' : 'Top categories'}>
            <h2 className="trends__top-title">{groupByProject ? 'Top Projects' : 'Top Categories'}</h2>
            <ul className="trends__top-list">
              {topBreakdown.map((entry) => (
                <li key={entry.key} className="trends__top-item">
                  <span className="trends__top-name">{entry.key}</span>
                  <span className="trends__top-duration">{formatDuration(entry.durationMs)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="trends__top" aria-label="Top apps">
            <h2 className="trends__top-title">Top Apps</h2>
            <ul className="trends__top-list">
              {trends.topApps.map((entry) => (
                <li key={entry.key} className="trends__top-item">
                  <span className="trends__top-name">{entry.key}</span>
                  <span className="trends__top-duration">{formatDuration(entry.durationMs)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <div className="today__empty" role="status">
          <h2 className="today__empty-title">Nothing tracked yet</h2>
          <p className="today__empty-body">Once heartbeats start flowing, your trends will appear here.</p>
        </div>
      )}
    </section>
  )
}

/** The local calendar range covering the last `days` days up to and including today. */
function getRangeMs(days: number): { startMs: number; endMs: number } {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() + 1)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { startMs: start.getTime(), endMs: end.getTime() }
}

function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}
