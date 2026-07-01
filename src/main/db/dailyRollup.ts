import type Database from 'better-sqlite3'
import { listCategories } from './categories'
import { getDerivationVersion } from './derivationVersion'
import { getHeartbeatsForRange } from './heartbeats'
import { listRules } from './rules'
import { derive } from '../../shared/derive'
import type { Span } from '../../shared/heartbeat'

export interface DailyRollupParams {
  /** Local calendar day, e.g. "2026-07-01". */
  dateKey: string
  startMs: number
  endMs: number
  now: number
}

interface DailyRollupRow {
  heartbeat_count: number
  spans_json: string
  rules_version: number
}

/**
 * The daily rollup read path: a cache in front of `derive()`, never a
 * replacement for raw heartbeats (ADR-0001). Recomputes whenever the day's
 * heartbeat count has changed, or Categories/Rules have been edited since
 * the row was cached (`rules_version`) — so editing a Rule re-derives
 * matching history immediately, with no migration. Always safely
 * re-derivable — deleting the row just forces a recompute.
 */
export function getOrComputeDailyRollup(db: Database.Database, params: DailyRollupParams): Span[] {
  const heartbeats = getHeartbeatsForRange(db, params.startMs, params.endMs)
  const rulesVersion = getDerivationVersion(db)

  const cached = db
    .prepare('SELECT heartbeat_count, spans_json, rules_version FROM daily_rollup WHERE date = ?')
    .get(params.dateKey) as DailyRollupRow | undefined

  if (cached && cached.heartbeat_count === heartbeats.length && cached.rules_version === rulesVersion) {
    return JSON.parse(cached.spans_json) as Span[]
  }

  const categories = listCategories(db)
  const rules = listRules(db)
  const { spans } = derive({ heartbeats, categories, rules, now: params.now })

  db.prepare(
    `
    INSERT INTO daily_rollup (date, heartbeat_count, spans_json, computed_at, rules_version)
    VALUES (@dateKey, @heartbeatCount, @spansJson, @computedAt, @rulesVersion)
    ON CONFLICT(date) DO UPDATE SET
      heartbeat_count = excluded.heartbeat_count,
      spans_json = excluded.spans_json,
      computed_at = excluded.computed_at,
      rules_version = excluded.rules_version
  `,
  ).run({
    dateKey: params.dateKey,
    heartbeatCount: heartbeats.length,
    spansJson: JSON.stringify(spans),
    computedAt: params.now,
    rulesVersion,
  })

  return spans
}
