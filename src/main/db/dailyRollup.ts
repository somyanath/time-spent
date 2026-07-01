import type Database from 'better-sqlite3'
import { derive } from '../../shared/derive'
import { getHeartbeatsForRange } from './heartbeats'
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
}

/**
 * The daily rollup read path: a cache in front of `derive()`, never a
 * replacement for raw heartbeats (ADR-0001). Recomputes whenever the day's
 * heartbeat count has changed since the row was cached, and is always
 * safely re-derivable — deleting the row just forces a recompute.
 */
export function getOrComputeDailyRollup(db: Database.Database, params: DailyRollupParams): Span[] {
  const heartbeats = getHeartbeatsForRange(db, params.startMs, params.endMs)

  const cached = db
    .prepare('SELECT heartbeat_count, spans_json FROM daily_rollup WHERE date = ?')
    .get(params.dateKey) as DailyRollupRow | undefined

  if (cached && cached.heartbeat_count === heartbeats.length) {
    return JSON.parse(cached.spans_json) as Span[]
  }

  const { spans } = derive({ heartbeats, now: params.now })

  db.prepare(
    `
    INSERT INTO daily_rollup (date, heartbeat_count, spans_json, computed_at)
    VALUES (@dateKey, @heartbeatCount, @spansJson, @computedAt)
    ON CONFLICT(date) DO UPDATE SET
      heartbeat_count = excluded.heartbeat_count,
      spans_json = excluded.spans_json,
      computed_at = excluded.computed_at
  `,
  ).run({
    dateKey: params.dateKey,
    heartbeatCount: heartbeats.length,
    spansJson: JSON.stringify(spans),
    computedAt: params.now,
  })

  return spans
}
