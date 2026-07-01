/**
 * The Today surface — the daily review home. Slice 1 is the walking skeleton,
 * so it renders an intentional empty state: no heartbeats are being collected
 * yet, so there is nothing to summarise. The Focus Quality Score, category
 * split, focus-vs-target and editable timeline land in later slices.
 */
export function Today(): JSX.Element {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const versions = typeof window !== 'undefined' ? window.timeTracker?.versions : undefined

  return (
    <section className="today" aria-labelledby="today-heading">
      <header className="today__header">
        <h1 id="today-heading" className="today__title">
          Today
        </h1>
        <p className="today__date">{today}</p>
      </header>

      <div className="today__empty" role="status">
        <div className="today__empty-glyph" aria-hidden="true" />
        <h2 className="today__empty-title">Nothing tracked yet</h2>
        <p className="today__empty-body">
          Tracking isn&rsquo;t running in this build. Once heartbeats start
          flowing, your Focus Quality Score, category split, and timeline will
          appear here.
        </p>
      </div>

      {versions && (
        <footer className="today__footer">
          Electron {versions.electron} · Chromium {versions.chrome} · Node{' '}
          {versions.node}
        </footer>
      )}
    </section>
  )
}
