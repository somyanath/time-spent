import type Database from 'better-sqlite3'
import { listCategories } from './categories'
import { listDiscardedSpansForRange } from './discardedSpans'
import { getHeartbeatsForRange } from './heartbeats'
import { listManualEntriesForRange } from './manualEntries'
import { listOverridesForRange } from './overrides'
import { listProjects } from './projects'
import { listRules } from './rules'
import { getWorkingHours, getWorkModeOverride } from './workMode'
import { derive } from '../../shared/derive'
import type { FocusQualityScoreBreakdown } from '../../shared/derive'

export interface FocusQualityParams {
  startMs: number
  endMs: number
  now: number
}

export interface FocusQualityResult {
  score: number
  breakdown: FocusQualityScoreBreakdown
}

/**
 * Today's Focus Quality Score (#25). Derived fresh on every call rather than
 * through the daily rollup cache: the score depends on the Working Hours
 * schedule and Work Mode override too, not just Spans, so it's simplest to
 * hand `derive()` the same day's inputs directly.
 */
export function getFocusQuality(db: Database.Database, params: FocusQualityParams): FocusQualityResult {
  const heartbeats = getHeartbeatsForRange(db, params.startMs, params.endMs)
  const categories = listCategories(db)
  const projects = listProjects(db)
  const rules = listRules(db)
  const overrides = listOverridesForRange(db, params.startMs, params.endMs)
  const manualEntries = listManualEntriesForRange(db, params.startMs, params.endMs)
  const discardedSpans = listDiscardedSpansForRange(db, params.startMs, params.endMs)
  const workingHours = getWorkingHours(db)
  const workModeOverride = getWorkModeOverride(db)

  const { focusQualityScore, focusQualityBreakdown } = derive({
    heartbeats,
    categories,
    projects,
    rules,
    overrides,
    manualEntries,
    discardedSpans,
    workingHours,
    workModeOverride,
    now: params.now,
  })

  return { score: focusQualityScore, breakdown: focusQualityBreakdown }
}
