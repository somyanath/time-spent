import type Database from 'better-sqlite3'
import type { Heartbeat } from '../../shared/heartbeat'

interface HeartbeatRow {
  startedAt: number
  endedAt: number
  appName: string
  bundleId: string | null
  windowTitle: string | null
  url: string | null
  idleSeconds: number
}

/** Batched, transactional insert — heartbeats are append-only (ADR-0001), never updated. */
export function insertHeartbeats(db: Database.Database, heartbeats: readonly Heartbeat[]): void {
  if (heartbeats.length === 0) return

  const insert = db.prepare(`
    INSERT INTO heartbeats (started_at, ended_at, app_name, bundle_id, window_title, url, idle_seconds)
    VALUES (@startedAt, @endedAt, @appName, @bundleId, @windowTitle, @url, @idleSeconds)
  `)

  const insertAll = db.transaction((rows: readonly Heartbeat[]) => {
    for (const row of rows) insert.run(row)
  })

  insertAll(heartbeats)
}

/** Heartbeats overlapping `[startMs, endMs)`, ascending by start time. */
export function getHeartbeatsForRange(db: Database.Database, startMs: number, endMs: number): Heartbeat[] {
  const rows = db
    .prepare(
      `
      SELECT
        started_at AS startedAt,
        ended_at AS endedAt,
        app_name AS appName,
        bundle_id AS bundleId,
        window_title AS windowTitle,
        url,
        idle_seconds AS idleSeconds
      FROM heartbeats
      WHERE ended_at > ? AND started_at < ?
      ORDER BY started_at ASC
    `,
    )
    .all(startMs, endMs) as HeartbeatRow[]

  return rows
}
