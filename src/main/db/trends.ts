import type Database from 'better-sqlite3'
import { getOrComputeDailyRollup } from './dailyRollup'
import { getWorkingHours } from './workMode'
import { computeDayFocusQuality } from '../../shared/derive'
import type { TrendsBreakdownEntry, TrendsDayEntry, TrendsResult } from '../../shared/trends'
import { iterateLocalDays } from '../dayRange'

export interface TrendsParams {
  startMs: number
  endMs: number
  now: number
}

/**
 * Trends (#28): reads each day's Spans from the daily rollup cache — the
 * same cache Today uses — so scanning months of history stays fast. Scores
 * each day with `computeDayFocusQuality`, which reuses `derive()`'s scoring
 * logic directly on the cached Spans rather than re-deriving from
 * Heartbeats.
 */
export function getTrends(db: Database.Database, params: TrendsParams): TrendsResult {
  const workingHours = getWorkingHours(db)
  const appTotals = new Map<string, number>()
  const categoryTotals = new Map<string, number>()
  const projectTotals = new Map<string, number>()

  let totalFocusMs = 0
  let totalDistractionMs = 0

  const days: TrendsDayEntry[] = iterateLocalDays(params.startMs, params.endMs).map((day) => {
    const spans = getOrComputeDailyRollup(db, {
      dateKey: day.dateKey,
      startMs: day.startMs,
      endMs: day.endMs,
      now: params.now,
    })

    let focusMs = 0
    let distractionMs = 0
    const dayCategoryTotals = new Map<string, number>()
    const dayProjectTotals = new Map<string, number>()

    for (const span of spans) {
      const durationMs = span.endedAt - span.startedAt
      if (span.rating === 'focus') focusMs += durationMs
      if (span.rating === 'distracting') distractionMs += durationMs

      addTo(appTotals, span.appName, durationMs)
      addTo(categoryTotals, span.categoryName, durationMs)
      addTo(dayCategoryTotals, span.categoryName, durationMs)
      if (span.projectName !== null) {
        addTo(projectTotals, span.projectName, durationMs)
        addTo(dayProjectTotals, span.projectName, durationMs)
      }
    }

    totalFocusMs += focusMs
    totalDistractionMs += distractionMs

    const { score } = computeDayFocusQuality(spans, workingHours)

    return {
      dateKey: day.dateKey,
      focusMs,
      distractionMs,
      focusQualityScore: score,
      categoryBreakdown: toSortedBreakdown(dayCategoryTotals),
      projectBreakdown: toSortedBreakdown(dayProjectTotals),
    }
  })

  return {
    days,
    totalFocusMs,
    totalDistractionMs,
    topApps: toSortedBreakdown(appTotals),
    topCategories: toSortedBreakdown(categoryTotals),
    topProjects: toSortedBreakdown(projectTotals),
  }
}

function addTo(totals: Map<string, number>, key: string, durationMs: number): void {
  totals.set(key, (totals.get(key) ?? 0) + durationMs)
}

function toSortedBreakdown(totals: Map<string, number>): TrendsBreakdownEntry[] {
  return [...totals.entries()].map(([key, durationMs]) => ({ key, durationMs })).sort((a, b) => b.durationMs - a.durationMs)
}
