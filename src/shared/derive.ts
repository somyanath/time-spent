import type { Heartbeat, Span } from './heartbeat'

/**
 * Tunable thresholds `derive()` reads. Later slices add focus-window,
 * idle, Nudge, and Break-Reminder thresholds here; this slice only needs
 * the Span merge-gap tolerance.
 */
export interface DeriveConfig {
  /**
   * How large a gap between two same-identity heartbeats is still treated
   * as one continuous Span, rather than an interruption. Bridges the small
   * gap a periodic tracker flush leaves before the next poll reopens a
   * heartbeat for the still-active app. Defaults to one poll interval.
   */
  mergeGapToleranceMs?: number
}

/**
 * The pure derivation core (seam ①). Reads stored Heartbeats plus
 * categorization/config inputs and an injected clock, and derives the
 * entire model. Only `spans` is populated this slice — the signature is the
 * contract later slices (#18-#27) grow into.
 */
export interface DeriveInput {
  heartbeats: readonly Heartbeat[]
  rules?: readonly unknown[]
  overrides?: readonly unknown[]
  manualEntries?: readonly unknown[]
  config?: DeriveConfig
  now: number
}

export interface DeriveResult {
  spans: Span[]
}

const DEFAULT_MERGE_GAP_TOLERANCE_MS = 3_000

export function derive(input: DeriveInput): DeriveResult {
  const mergeGapToleranceMs = input.config?.mergeGapToleranceMs ?? DEFAULT_MERGE_GAP_TOLERANCE_MS

  const sorted = input.heartbeats
    .filter((heartbeat) => heartbeat.startedAt <= input.now)
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt)

  const spans: Span[] = []
  for (const heartbeat of sorted) {
    const last = spans[spans.length - 1]
    if (last && sameIdentity(last, heartbeat) && heartbeat.startedAt - last.endedAt <= mergeGapToleranceMs) {
      last.endedAt = Math.max(last.endedAt, heartbeat.endedAt)
      continue
    }
    spans.push({
      startedAt: heartbeat.startedAt,
      endedAt: heartbeat.endedAt,
      appName: heartbeat.appName,
      bundleId: heartbeat.bundleId,
      windowTitle: heartbeat.windowTitle,
      url: heartbeat.url,
    })
  }

  return { spans }
}

function sameIdentity(span: Span, heartbeat: Heartbeat): boolean {
  return (
    span.appName === heartbeat.appName &&
    span.bundleId === heartbeat.bundleId &&
    span.windowTitle === heartbeat.windowTitle &&
    span.url === heartbeat.url
  )
}
