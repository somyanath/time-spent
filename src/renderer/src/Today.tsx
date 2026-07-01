import { useEffect, useState } from 'react'
import type { Span } from '../../shared/heartbeat'

/**
 * The Today surface — the daily review home. This slice renders the raw,
 * uncategorized timeline of derived Spans; categorization, the Focus Quality
 * Score, and editable entries arrive with later slices.
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

  return (
    <section className="today" aria-labelledby="today-heading">
      <header className="today__header">
        <h1 id="today-heading" className="today__title">
          Today
        </h1>
        <p className="today__date">{today}</p>
      </header>

      {spans && spans.length > 0 ? (
        <ol className="today__timeline" aria-label="Today's timeline">
          {spans.map((span) => (
            <li key={`${span.startedAt}-${span.appName}`} className="today__timeline-item">
              <span className="today__timeline-app">{span.appName}</span>
              <span className="today__timeline-time">
                {formatTime(span.startedAt)} – {formatTime(span.endedAt)}
              </span>
            </li>
          ))}
        </ol>
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
