import { useEffect, useState } from 'react'
import type { AppSettings } from '../../shared/permissions'

/**
 * Surfaces the per-install token (#22) the browser extension needs to
 * authenticate its localhost WebSocket connection — the only place a user
 * can get this value to paste into the extension's options page.
 */
export function BrowserUrlSettings(): JSX.Element | null {
  const api = typeof window !== 'undefined' ? window.timeTracker : undefined
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    if (!api) return
    api.getSettings().then(setSettings)
  }, [api])

  if (!settings) return null

  return (
    <section className="settings__section" aria-labelledby="browser-url-heading">
      <h2 id="browser-url-heading" className="settings__section-title">
        Browser URL Capture
      </h2>
      <p className="settings__section-hint">
        Paste this token into the Time Tracker browser extension's options page so it can report the active tab URL
        over an authenticated, localhost-only connection. AppleScript is used as a fallback in Safari, Chrome, Edge,
        Brave, and Arc when the extension isn't installed or running.
      </p>
      <p className="settings__section-hint">
        Token: <code>{settings.wsToken}</code>
      </p>
    </section>
  )
}
