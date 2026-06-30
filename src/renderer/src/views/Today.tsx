import { useEffect, useState } from 'react'
import type { DbStatus } from '@shared/ipc'

function today(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * The Today surface. Empty for the walking skeleton — the Focus Quality Score,
 * focus-vs-target, category split, and editable timeline arrive with the
 * derivation and UI slices. A small status line proves the persistence layer is
 * wired through to the renderer.
 */
export function Today(): React.JSX.Element {
  const [status, setStatus] = useState<DbStatus | null>(null)

  useEffect(() => {
    window.api.getDbStatus().then(setStatus).catch(console.error)
  }, [])

  return (
    <section className="today">
      <header className="today__header">
        <h1 className="today__title">Today</h1>
        <p className="today__date">{today()}</p>
      </header>

      <div className="empty-state">
        <p className="empty-state__headline">Nothing tracked yet.</p>
        <p className="empty-state__sub">
          Tracking and your daily Focus Quality Score arrive in the next slices. This is the
          walking skeleton — the menu-bar agent, renderer, and local database are alive.
        </p>
      </div>

      <footer className="status-bar">
        {status ? (
          <>
            <span className={status.open ? 'status-dot status-dot--ok' : 'status-dot'} />
            <span>Local database connected</span>
            <span className="status-bar__sep">·</span>
            <span>schema v{status.schemaVersion}</span>
            <span className="status-bar__sep">·</span>
            <span className="status-bar__path" title={status.path}>
              {status.path}
            </span>
          </>
        ) : (
          <span>Connecting to local database…</span>
        )}
      </footer>
    </section>
  )
}
