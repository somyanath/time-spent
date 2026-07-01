import { useCallback, useEffect, useState } from 'react'
import type { PermissionsStatus, ScreenRecordingStatus } from '../../shared/permissions'

const STATUS_LABEL: Record<ScreenRecordingStatus, string> = {
  authorized: 'Granted',
  denied: 'Denied',
  restricted: 'Restricted',
  'not-determined': 'Not yet requested',
}

/**
 * Screen Recording permission UX (#21): explains why the grant is needed,
 * surfaces its live status (re-checked on window focus, since macOS re-prompts
 * periodically), detects a silent lapse, and offers the App-level-only mode
 * that runs with no grant at all — a deliberate privacy choice, not a
 * fallback for the failure state.
 */
export function PermissionsSettings(): JSX.Element {
  const api = typeof window !== 'undefined' ? window.timeTracker : undefined

  const [status, setStatus] = useState<PermissionsStatus | null>(null)

  const refresh = useCallback(async () => {
    if (!api) return
    setStatus(await api.getPermissionsStatus())
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Sequoia periodically re-prompts / silently revokes the grant — catch
  // that quickly by re-checking whenever the dashboard regains focus.
  useEffect(() => {
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  async function handleToggleAppLevelOnly(): Promise<void> {
    if (!api || !status) return
    await api.setAppLevelOnly(!status.appLevelOnly)
    await refresh()
  }

  async function handleRequestAccess(): Promise<void> {
    if (!api) return
    await api.requestScreenRecordingAccess()
    await refresh()
  }

  async function handleOpenSettings(): Promise<void> {
    if (!api) return
    await api.openScreenRecordingSettings()
  }

  return (
    <section className="settings__section" aria-labelledby="permissions-heading">
      <h2 id="permissions-heading" className="settings__section-title">
        Permissions
      </h2>
      <p className="settings__section-hint">
        Screen Recording lets the app read the active window's <strong>title</strong> — e.g. "Inbox — Gmail" instead
        of just "Chrome" — so title-based Rules can match. The app only ever reads window metadata (app name, title,
        URL): it never takes screenshots and never reads keystrokes.
      </p>

      {status && (
        <>
          <p className="settings__section-hint">
            Status: <strong>{STATUS_LABEL[status.screenRecordingStatus]}</strong>
            {status.appLevelOnly && ' (App-level-only mode is on, so it is not being used)'}
          </p>

          {status.silentLapseDetected && (
            <p className="settings__section-hint" role="alert">
              Titles have stopped arriving even though the grant should be active — macOS may have silently revoked
              it. Re-enable it below, then quit and relaunch the app to pick the grant back up.
            </p>
          )}

          <div className="settings__form">
            {status.screenRecordingStatus !== 'authorized' && !status.appLevelOnly && (
              <button type="button" onClick={handleRequestAccess}>
                Request Access
              </button>
            )}
            <button type="button" onClick={handleOpenSettings}>
              Open System Settings
            </button>
            <label className="settings__toggle">
              <input type="checkbox" checked={status.appLevelOnly} onChange={handleToggleAppLevelOnly} />
              App-level-only mode (track app names only, no titles, no Screen Recording grant)
            </label>
          </div>

          <p className="settings__section-hint">
            After granting access in System Settings, quit and relaunch the app — macOS only picks up a fresh grant
            on the next launch.
          </p>
        </>
      )}
    </section>
  )
}
