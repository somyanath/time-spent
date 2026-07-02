/**
 * Trends (#28): the longer-pattern surface alongside Today. Reads each day's
 * Spans from the daily rollup cache, so viewing months of history stays
 * fast, and Categories/Rules edits are reflected as soon as the cache is
 * invalidated (same guarantee as Today, #18).
 */
export interface TrendsBreakdownEntry {
  key: string
  durationMs: number
}

export interface TrendsDayEntry {
  /** Local calendar day, e.g. "2026-07-01". */
  dateKey: string
  focusMs: number
  distractionMs: number
  /** 0–100, work-hours-scoped; same score Today shows for the current day. */
  focusQualityScore: number
  categoryBreakdown: TrendsBreakdownEntry[]
  /** Per-project effort for the day — covers the deferred per-project report (#28) without a separate screen. */
  projectBreakdown: TrendsBreakdownEntry[]
}

export interface TrendsResult {
  days: TrendsDayEntry[]
  totalFocusMs: number
  totalDistractionMs: number
  topApps: TrendsBreakdownEntry[]
  topCategories: TrendsBreakdownEntry[]
  topProjects: TrendsBreakdownEntry[]
}
