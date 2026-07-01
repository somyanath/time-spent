import type { Span } from './heartbeat'

/**
 * The typed surface the preload bridge exposes to the renderer on
 * `window.timeTracker`. Kept in `shared/` so both the preload (which implements
 * it) and the renderer (which consumes it) depend on one definition.
 */
export interface TimeTrackerApi {
  versions: {
    electron: string
    chrome: string
    node: string
  }
  /** Today's derived Spans, via the daily rollup cache. */
  getTodaySpans: () => Promise<Span[]>
}
