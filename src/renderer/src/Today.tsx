import { useEffect, useMemo, useState } from 'react'
import type { Span } from '../../shared/heartbeat'

/**
 * The Today surface — the daily review home. Renders the category-colored
 * timeline of derived Spans plus a category split summary (#18); the Focus
 * Quality Score and editable entries arrive with later slices.
 */
export function Today(): JSX.Element {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const [spans, setSpans] = useState<Span[] | null>(null)

  useEffect(() => {
    let cancelled = false

    const api = typeof window !== 'undefined' ? window.timeTracker : undefined
    if (!api) return

    api.getTodaySpans().then((result) => {
      if (!cancelled) setSpans(result)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const versions = typeof window !== 'undefined' ? window.timeTracker?.versions : undefined

  const categorySplit = useMemo(() => summarizeCategorySplit(spans ?? []), [spans])

  return (
    <section className="today" aria-labelledby="today-heading">
      <header className="today__header">
        <h1 id="today-heading" className="today__title">
          Today
        </h1>
        <p className="today__date">{today}</p>
      </header>

      {spans && spans.length > 0 ? (
        <>
          <ul className="today__category-split" aria-label="Category split">
            {categorySplit.map((entry) => (
              <li key={entry.categoryName} className="today__category-split-item">
                <span className={`today__rating-dot today__rating-dot--${entry.rating}`} aria-hidden="true" />
                <span className="today__category-split-name">{entry.categoryName}</span>
                <span className="today__category-split-duration">{formatDuration(entry.durationMs)}</span>
              </li>
            ))}
          </ul>

          <ol className="today__timeline" aria-label="Today's timeline">
            {spans.map((span) => (
              <li key={`${span.startedAt}-${span.appName}`} className="today__timeline-item">
                <span className={`today__rating-dot today__rating-dot--${span.rating}`} aria-hidden="true" />
                <span className="today__timeline-app">{span.appName}</span>
                <span className="today__timeline-category">{span.categoryName}</span>
                <span className="today__timeline-time">
                  {formatTime(span.startedAt)} – {formatTime(span.endedAt)}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="today__empty" role="status">
          <div className="today__empty-glyph" aria-hidden="true" />
          <h2 className="today__empty-title">Nothing tracked yet</h2>
          <p className="today__empty-body">
            Once heartbeats start flowing, your Focus Quality Score, category
            split, and timeline will appear here.
          </p>
        </div>
      )}

      {versions && (
        <footer className="today__footer">
          Electron {versions.electron} · Chromium {versions.chrome} · Node{' '}
          {versions.node}
        </footer>
      )}
    </section>
  )
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

interface CategorySplitEntry {
  categoryName: string
  rating: Span['rating']
  durationMs: number
}

/** Total tracked time per Category, largest first. */
function summarizeCategorySplit(spans: readonly Span[]): CategorySplitEntry[] {
  const byCategory = new Map<string, CategorySplitEntry>()

  for (const span of spans) {
    const durationMs = span.endedAt - span.startedAt
    const existing = byCategory.get(span.categoryName)
    if (existing) {
      existing.durationMs += durationMs
    } else {
      byCategory.set(span.categoryName, { categoryName: span.categoryName, rating: span.rating, durationMs })
    }
  }

  return [...byCategory.values()].sort((a, b) => b.durationMs - a.durationMs)
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}
