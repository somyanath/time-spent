import type Database from 'better-sqlite3'
import { listCategories } from './categories'
import { listDiscardedSpansForRange } from './discardedSpans'
import { getGoalsConfig } from './goals'
import { getHeartbeatsForRange } from './heartbeats'
import { listManualEntriesForRange } from './manualEntries'
import { listOverridesForRange } from './overrides'
import { listProjects } from './projects'
import { listRules } from './rules'
import { getWorkingHours, getWorkModeOverride } from './workMode'
import { derive } from '../../shared/derive'
import type { GoalProgress } from '../../shared/derive'

export interface GoalProgressParams {
  startMs: number
  endMs: number
  now: number
}

/**
 * Today's Goal progress (#27), derived fresh on every call for the same
 * reason as `getFocusQuality()`: it depends on the Working Hours schedule
 * and Work Mode override, not just Spans.
 */
export function getGoalProgress(db: Database.Database, params: GoalProgressParams): GoalProgress {
  const heartbeats = getHeartbeatsForRange(db, params.startMs, params.endMs)
  const categories = listCategories(db)
  const projects = listProjects(db)
  const rules = listRules(db)
  const overrides = listOverridesForRange(db, params.startMs, params.endMs)
  const manualEntries = listManualEntriesForRange(db, params.startMs, params.endMs)
  const discardedSpans = listDiscardedSpansForRange(db, params.startMs, params.endMs)
  const workingHours = getWorkingHours(db)
  const workModeOverride = getWorkModeOverride(db)
  const { focusTargetMs, overworkCeilingMs } = getGoalsConfig(db)

  const { goalProgress } = derive({
    heartbeats,
    categories,
    projects,
    rules,
    overrides,
    manualEntries,
    discardedSpans,
    workingHours,
    workModeOverride,
    config: { focusTargetMs, overworkCeilingMs },
    now: params.now,
  })

  return goalProgress
}
