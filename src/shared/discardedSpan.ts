/**
 * A stored time range excluded from all metrics. Matched against a derived
 * Span by time-range overlap in `derive()`; the underlying Heartbeats are
 * untouched, only the derived Span covering this range is dropped from the
 * output.
 */
export interface DiscardedSpan {
  id: number
  startedAt: number
  endedAt: number
}
