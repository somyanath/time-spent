import type Database from 'better-sqlite3'
import { bumpDerivationVersion } from './derivationVersion'
import type { DiscardedSpan } from '../../shared/discardedSpan'

interface DiscardedSpanRow {
  id: number
  startedAt: number
  endedAt: number
}

export function listDiscardedSpans(db: Database.Database): DiscardedSpan[] {
  return db
    .prepare(
      `
      SELECT id, started_at AS startedAt, ended_at AS endedAt
      FROM discarded_spans
      ORDER BY started_at ASC
    `,
    )
    .all() as DiscardedSpanRow[]
}

/** Discarded Spans overlapping `[startMs, endMs)`, ascending by start time — mirrors `getHeartbeatsForRange`. */
export function listDiscardedSpansForRange(db: Database.Database, startMs: number, endMs: number): DiscardedSpan[] {
  return db
    .prepare(
      `
      SELECT id, started_at AS startedAt, ended_at AS endedAt
      FROM discarded_spans
      WHERE ended_at > ? AND started_at < ?
      ORDER BY started_at ASC
    `,
    )
    .all(startMs, endMs) as DiscardedSpanRow[]
}

export interface NewDiscardedSpan {
  startedAt: number
  endedAt: number
}

/** Excludes the time range from all metrics by bumping the derivation version; the underlying Heartbeats are untouched. */
export function createDiscardedSpan(db: Database.Database, span: NewDiscardedSpan): DiscardedSpan {
  let id = 0

  db.transaction(() => {
    const result = db
      .prepare('INSERT INTO discarded_spans (started_at, ended_at) VALUES (@startedAt, @endedAt)')
      .run(span)
    id = result.lastInsertRowid as number
    bumpDerivationVersion(db)
  })()

  return { id, startedAt: span.startedAt, endedAt: span.endedAt }
}
