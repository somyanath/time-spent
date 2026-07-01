import type { ProductivityRating } from './category'

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
 * consecutive like-Heartbeats on read (`derive()`). Categorized via the
 * ordered Rules layer (`categoryId`/`categoryName`/`rating` are the
 * Uncategorized default when no Rule matches) and, orthogonally, attributed
 * to a Project the same way (`projectId`/`projectName` are null when no
 * matching Rule assigns one). Overrides arrive with a later slice.
 */
export interface Span {
  startedAt: number
  endedAt: number
  appName: string
  bundleId: string | null
  windowTitle: string | null
  url: string | null
  categoryId: number | null
  categoryName: string
  rating: ProductivityRating
  projectId: number | null
  projectName: string | null
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
