/**
 * The observed-facts shapes shared across the main process and renderer.
 *
 * Per ADR-0001, a Heartbeat carries only what was directly observed — no
 * derived columns (category, session, interval). `windowTitle` and `url` are
 * nullable and always null in this slice; they're populated by the Screen
 * Recording (#21) and browser-capture (#22) slices.
 */
export interface Heartbeat {
  startedAt: number
  endedAt: number
  appName: string
  bundleId: string | null
  windowTitle: string | null
  url: string | null
  idleSeconds: number
}

/**
 * A contiguous interval with a single attribution, derived by merging
 * consecutive like-Heartbeats on read (`derive()`). Categorization
 * (Category/Project/rating) arrives with later slices.
 */
export interface Span {
  startedAt: number
  endedAt: number
  appName: string
  bundleId: string | null
  windowTitle: string | null
  url: string | null
}

/** A single point-in-time poll result, before the tracker coalesces it into a Heartbeat. */
export interface Observation {
  timestamp: number
  appName: string
  bundleId: string | null
  windowTitle: string | null
  url: string | null
  idleSeconds: number
}

/**
 * Unifies the collection sources (active-win + powerMonitor, later the
 * extension WS feed and AppleScript fallback) behind one interface the
 * tracker loop consumes, so it can be driven by a fake source in tests.
 */
export interface HeartbeatSource {
  start(onObservation: (observation: Observation) => void): void
  stop(): void
}
