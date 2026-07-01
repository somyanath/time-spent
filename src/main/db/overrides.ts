import type Database from 'better-sqlite3'
import { bumpDerivationVersion } from './derivationVersion'
import type { Override } from '../../shared/override'

interface OverrideRow {
  id: number
  startedAt: number
  endedAt: number
  categoryId: number
  projectId: number | null
}

export function listOverrides(db: Database.Database): Override[] {
  return db
    .prepare(
      `
      SELECT
        id,
        started_at AS startedAt,
        ended_at AS endedAt,
        category_id AS categoryId,
        project_id AS projectId
      FROM overrides
      ORDER BY started_at ASC
    `,
    )
    .all() as OverrideRow[]
}

/** Overrides overlapping `[startMs, endMs)`, ascending by start time — mirrors `getHeartbeatsForRange`. */
export function listOverridesForRange(db: Database.Database, startMs: number, endMs: number): Override[] {
  return db
    .prepare(
      `
      SELECT
        id,
        started_at AS startedAt,
        ended_at AS endedAt,
        category_id AS categoryId,
        project_id AS projectId
      FROM overrides
      WHERE ended_at > ? AND started_at < ?
      ORDER BY started_at ASC
    `,
    )
    .all(startMs, endMs) as OverrideRow[]
}

export interface NewOverride {
  startedAt: number
  endedAt: number
  categoryId: number
  projectId?: number | null
}

/** Stores the Override and bumps the derivation version so the daily rollup cache re-derives with it applied. */
export function createOverride(db: Database.Database, override: NewOverride): Override {
  const projectId = override.projectId ?? null
  let id = 0

  db.transaction(() => {
    const result = db
      .prepare(
        `
        INSERT INTO overrides (started_at, ended_at, category_id, project_id)
        VALUES (@startedAt, @endedAt, @categoryId, @projectId)
      `,
      )
      .run({ startedAt: override.startedAt, endedAt: override.endedAt, categoryId: override.categoryId, projectId })
    id = result.lastInsertRowid as number
    bumpDerivationVersion(db)
  })()

  return { id, startedAt: override.startedAt, endedAt: override.endedAt, categoryId: override.categoryId, projectId }
}

/** Reverts the time range to whatever the Rules layer computes for it. */
export function deleteOverride(db: Database.Database, id: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM overrides WHERE id = ?').run(id)
    bumpDerivationVersion(db)
  })()
}
