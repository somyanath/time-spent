import activeWin from '@rize-io/active-win'
import { powerMonitor } from 'electron'
import type { HeartbeatSource, Observation } from '../../shared/heartbeat'

export interface ActiveWinHeartbeatSourceOptions {
  /** How often to poll the frontmost app. Defaults to 3s per the PRD. */
  pollIntervalMs?: number
  /**
   * Read live before every poll, so toggling App-level-only mode (#21) takes
   * effect on the very next tick without restarting the source. `false`
   * (the default) skips the Screen Recording check entirely and titles
   * always come back null — the app-level-only behavior this slice started
   * with, now also reachable as a deliberate, user-chosen privacy mode.
   */
  isAppLevelOnly?: () => boolean
}

const DEFAULT_POLL_INTERVAL_MS = 3_000

/**
 * The primary HeartbeatSource: polls `active-win` for the frontmost app and
 * window title (gated on the Screen Recording grant, #21) and `powerMonitor`
 * for idle seconds. URLs arrive with the browser-capture slice (#22).
 */
export class ActiveWinHeartbeatSource implements HeartbeatSource {
  private readonly pollIntervalMs: number
  private readonly isAppLevelOnly: () => boolean
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(options: ActiveWinHeartbeatSourceOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
    this.isAppLevelOnly = options.isAppLevelOnly ?? (() => false)
  }

  start(onObservation: (observation: Observation) => void): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.poll(onObservation)
    }, this.pollIntervalMs)
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  private async poll(onObservation: (observation: Observation) => void): Promise<void> {
    try {
      const appLevelOnly = this.isAppLevelOnly()
      // App-level-only mode never triggers the Screen Recording prompt and
      // never reads titles, by design (#21) — not just when the grant is absent.
      const result = await activeWin({ screenRecordingPermission: !appLevelOnly })
      if (!result) return

      onObservation({
        timestamp: Date.now(),
        appName: result.owner.name,
        bundleId: result.platform === 'macos' ? String(result.owner.bundleId) : null,
        // `title` comes back as '' (not undefined) whenever it isn't
        // available — both deliberately (App-level-only) and silently
        // (a lapsed grant); either way that's "no title", not an empty string.
        windowTitle: !appLevelOnly && result.platform === 'macos' && result.title !== '' ? result.title : null,
        url: null,
        idleSeconds: Math.round(powerMonitor.getSystemIdleTime()),
      })
    } catch (error) {
      console.error('[tracker] active-win poll failed', error)
    }
  }
}
