import activeWin from '@rize-io/active-win'
import { powerMonitor } from 'electron'
import type { HeartbeatSource, Observation } from '../../shared/heartbeat'

export interface ActiveWinHeartbeatSourceOptions {
  /** How often to poll the frontmost app. Defaults to 3s per the PRD. */
  pollIntervalMs?: number
}

const DEFAULT_POLL_INTERVAL_MS = 3_000

/**
 * The primary HeartbeatSource: polls `active-win` for the frontmost app
 * (app-level only — no Screen Recording permission, no titles/URLs yet) and
 * `powerMonitor` for idle seconds. Window titles and URLs arrive with the
 * Screen Recording (#21) and browser-capture (#22) slices.
 */
export class ActiveWinHeartbeatSource implements HeartbeatSource {
  private readonly pollIntervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(options: ActiveWinHeartbeatSourceOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
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
      // Disabling the Screen Recording permission check keeps this slice
      // app-level-only: `title` always comes back empty and no prompt fires.
      const result = await activeWin({ screenRecordingPermission: false })
      if (!result) return

      onObservation({
        timestamp: Date.now(),
        appName: result.owner.name,
        bundleId: result.platform === 'macos' ? String(result.owner.bundleId) : null,
        windowTitle: null,
        url: null,
        idleSeconds: Math.round(powerMonitor.getSystemIdleTime()),
      })
    } catch (error) {
      console.error('[tracker] active-win poll failed', error)
    }
  }
}
