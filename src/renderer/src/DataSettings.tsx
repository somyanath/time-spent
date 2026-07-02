import { useState } from 'react'

/**
 * Data ownership (#78/#76/#77): everything here reinforces that all data is
 * local, with zero telemetry and no network calls (the only network in the
 * app remains the localhost extension transport, #22). CSV export and the
 * DB copy write wherever the user picks in a native save dialog; delete is
 * a destructive, confirmed action gated behind a native confirm prompt.
 */
export function DataSettings(): JSX.Element {
  const api = typeof window !== 'undefined' ? window.timeTracker : undefined

  const [status, setStatus] = useState<string | null>(null)

  async function handleExportSpans(): Promise<void> {
    if (!api) return
    const result = await api.exportSpansCsv()
    setStatus(result.canceled ? null : `Exported spans to ${result.filePath}`)
  }

  async function handleExportDailyRollups(): Promise<void> {
    if (!api) return
    const result = await api.exportDailyRollupsCsv()
    setStatus(result.canceled ? null : `Exported daily rollups to ${result.filePath}`)
  }

  async function handleCopyDatabase(): Promise<void> {
    if (!api) return
    const result = await api.copyDatabase()
    setStatus(result.canceled ? null : `Copied database to ${result.filePath}`)
  }

  async function handleDeleteAllData(): Promise<void> {
    if (!api) return
    const confirmed = window.confirm(
      'Delete all tracked data? This permanently erases every Heartbeat, Span, Override, Manual Entry, and ' +
        'Discarded span. Categories, Projects, and Rules are kept. This cannot be undone.',
    )
    if (!confirmed) return
    await api.deleteAllData()
    setStatus('All tracked data deleted.')
  }

  return (
    <section className="settings__section" aria-labelledby="data-heading">
      <h2 id="data-heading" className="settings__section-title">
        Data
      </h2>
      <p className="settings__section-hint">
        All data stays on this Mac — there is no telemetry and no network call beyond the local extension transport.
        Export or back it up any time, or wipe it entirely.
      </p>

      <div className="settings__form">
        <button type="button" onClick={handleExportSpans}>
          Export Spans (CSV)
        </button>
        <button type="button" onClick={handleExportDailyRollups}>
          Export Daily Rollups (CSV)
        </button>
        <button type="button" onClick={handleCopyDatabase}>
          Copy Database File
        </button>
        <button type="button" className="settings__delete" onClick={handleDeleteAllData}>
          Delete All Data
        </button>
      </div>

      {status && (
        <p className="settings__section-hint" role="status">
          {status}
        </p>
      )}
    </section>
  )
}
