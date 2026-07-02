import type Database from 'better-sqlite3'
import type { GoalsConfig } from '../../shared/goals'

export function getGoalsConfig(db: Database.Database): GoalsConfig {
  const row = db
    .prepare('SELECT focus_target_ms AS focusTargetMs, overwork_ceiling_ms AS overworkCeilingMs FROM settings WHERE id = 1')
    .get() as { focusTargetMs: number | null; overworkCeilingMs: number | null }
  return { focusTargetMs: row.focusTargetMs, overworkCeilingMs: row.overworkCeilingMs }
}

export function setGoalsConfig(db: Database.Database, config: GoalsConfig): GoalsConfig {
  db.prepare('UPDATE settings SET focus_target_ms = ?, overwork_ceiling_ms = ? WHERE id = 1').run(
    config.focusTargetMs,
    config.overworkCeilingMs,
  )
  return getGoalsConfig(db)
}
