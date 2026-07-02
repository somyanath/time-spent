import type { Heartbeat, Observation } from '../../shared/heartbeat'

export interface HeartbeatTrackerOptions {
  persist: (heartbeats: readonly Heartbeat[]) => void
  /**
   * Read fresh on every Observation (#30's privacy-pause toggle). While
   * true, Observations are dropped and any open Heartbeat is closed exactly
   * like a system suspend — collection halts entirely until it reads false
   * again, no restart required.
   */
  isPaused?: () => boolean
}

/**
 * Coalesces the raw per-poll Observations a HeartbeatSource emits into
 * append-only Heartbeats: consecutive observations sharing the same
 * app/window/url identity extend one in-memory open Heartbeat instead of
 * each becoming their own row (the "sub-sample flicker" coalescing).
 *
 * A persisted Heartbeat is never updated (ADR-0001's append-only rule) —
 * flush() always closes the open Heartbeat and hands every Heartbeat
 * completed since the last flush to `persist` in one batch. A still-active
 * app naturally reopens on the next Observation, leaving a small gap that
 * `derive()`'s merge-gap tolerance stitches back into one Span on read.
 */
export class HeartbeatTracker {
  private open: Heartbeat | null = null
  private pending: Heartbeat[] = []

  constructor(private readonly options: HeartbeatTrackerOptions) {}

  handleObservation(observation: Observation): void {
    if (this.options.isPaused?.()) {
      this.closeOpen()
      return
    }

    if (this.open && sameIdentity(this.open, observation)) {
      this.open.endedAt = observation.timestamp
      this.open.idleSeconds = observation.idleSeconds
      return
    }

    this.closeOpen()
    this.open = {
      startedAt: observation.timestamp,
      endedAt: observation.timestamp,
      appName: observation.appName,
      bundleId: observation.bundleId,
      windowTitle: observation.windowTitle,
      url: observation.url,
      idleSeconds: observation.idleSeconds,
    }
  }

  /** Sleep/lock closes the open span cleanly so sleep is never counted as activity. */
  handleSystemSuspend(): void {
    this.closeOpen()
  }

  flush(): void {
    this.closeOpen()
    if (this.pending.length === 0) return
    this.options.persist(this.pending)
    this.pending = []
  }

  private closeOpen(): void {
    if (!this.open) return
    this.pending.push(this.open)
    this.open = null
  }
}

function sameIdentity(heartbeat: Heartbeat, observation: Observation): boolean {
  return (
    heartbeat.appName === observation.appName &&
    heartbeat.bundleId === observation.bundleId &&
    heartbeat.windowTitle === observation.windowTitle &&
    heartbeat.url === observation.url
  )
}
