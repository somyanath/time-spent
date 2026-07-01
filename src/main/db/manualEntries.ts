import type Database from 'better-sqlite3'
import { bumpDerivationVersion } from './derivationVersion'
import type { ManualEntry } from '../../shared/manualEntry'

interface ManualEntryRow {
  id: number
  startedAt: number
  endedAt: number
  label: string
  categoryId: number
  projectId: number | null
}

export function listManualEntries(db: Database.Database): ManualEntry[] {
  return db
    .prepare(
      `
      SELECT
        id,
        started_at AS startedAt,
        ended_at AS endedAt,
        label,
        category_id AS categoryId,
        project_id AS projectId
      FROM manual_entries
      ORDER BY started_at ASC
    `,
    )
    .all() as ManualEntryRow[]
}

/** Manual Entries overlapping `[startMs, endMs)`, ascending by start time — mirrors `getHeartbeatsForRange`. */
export function listManualEntriesForRange(db: Database.Database, startMs: number, endMs: number): ManualEntry[] {
  return db
    .prepare(
      `
      SELECT
        id,
        started_at AS startedAt,
        ended_at AS endedAt,
        label,
        category_id AS categoryId,
        project_id AS projectId
      FROM manual_entries
      WHERE ended_at > ? AND started_at < ?
      ORDER BY started_at ASC
    `,
    )
    .all(startMs, endMs) as ManualEntryRow[]
}

export interface NewManualEntry {
  startedAt: number
  endedAt: number
  label: string
  categoryId: number
  projectId?: number | null
}

/** Stores the Manual Entry and bumps the derivation version so it's merged in by the next daily rollup read. */
export function createManualEntry(db: Database.Database, entry: NewManualEntry): ManualEntry {
  const projectId = entry.projectId ?? null
  let id = 0

  db.transaction(() => {
    const result = db
      .prepare(
        `
        INSERT INTO manual_entries (started_at, ended_at, label, category_id, project_id)
        VALUES (@startedAt, @endedAt, @label, @categoryId, @projectId)
      `,
      )
      .run({ startedAt: entry.startedAt, endedAt: entry.endedAt, label: entry.label, categoryId: entry.categoryId, projectId })
    id = result.lastInsertRowid as number
    bumpDerivationVersion(db)
  })()

  return { id, startedAt: entry.startedAt, endedAt: entry.endedAt, label: entry.label, categoryId: entry.categoryId, projectId }
}

export function deleteManualEntry(db: Database.Database, id: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM manual_entries WHERE id = ?').run(id)
    bumpDerivationVersion(db)
  })()
}
