import type Database from 'better-sqlite3'
import { getOrComputeDailyRollup } from './dailyRollup'
import { getEarliestHeartbeatStartedAt } from './heartbeats'
import { getTrends } from './trends'
import { getLocalDayRange, iterateLocalDays } from '../dayRange'

export interface ExportParams {
  now: number
}

const SPANS_CSV_HEADER = ['startedAt', 'endedAt', 'appName', 'windowTitle', 'url', 'category', 'rating', 'project']
const DAILY_ROLLUPS_CSV_HEADER = ['date', 'focusMs', 'distractionMs', 'focusQualityScore']

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function csvRow(fields: readonly string[]): string {
  return fields.map(csvField).join(',')
}

function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

/** From the first recorded Heartbeat through the end of `now`'s local day — "all data" for an export. */
function exportRange(db: Database.Database, now: number): { startMs: number; endMs: number } {
  const { endMs } = getLocalDayRange(now)
  const earliest = getEarliestHeartbeatStartedAt(db)
  return { startMs: earliest ?? endMs, endMs }
}

/**
 * The full history of derived Spans (#78/#76), one row per Span, for
 * analysis outside the app. Reads through the same daily rollup cache the
 * dashboards use, so it reflects the current Categories/Rules/Overrides.
 */
export function exportSpansCsv(db: Database.Database, params: ExportParams): string {
  const { startMs, endMs } = exportRange(db, params.now)

  const rows = [SPANS_CSV_HEADER]
  for (const day of iterateLocalDays(startMs, endMs)) {
    const spans = getOrComputeDailyRollup(db, { ...day, now: params.now })
    for (const span of spans) {
      rows.push([
        toIso(span.startedAt),
        toIso(span.endedAt),
        span.appName,
        span.windowTitle ?? '',
        span.url ?? '',
        span.categoryName,
        span.rating,
        span.projectName ?? '',
      ])
    }
  }

  return rows.map(csvRow).join('\n')
}

/**
 * The full history of daily rollups (#78/#76), one row per local calendar
 * day: the same per-day totals Trends charts, for analysis outside the app.
 */
export function exportDailyRollupsCsv(db: Database.Database, params: ExportParams): string {
  const { startMs, endMs } = exportRange(db, params.now)
  const { days } = getTrends(db, { startMs, endMs, now: params.now })

  const rows = [DAILY_ROLLUPS_CSV_HEADER]
  for (const day of days) {
    rows.push([day.dateKey, String(day.focusMs), String(day.distractionMs), String(day.focusQualityScore)])
  }

  return rows.map(csvRow).join('\n')
}

/**
 * Wipes the Heartbeat ledger and everything derived from/about it (#78) —
 * the tracked activity data. Categories/Rules/Projects/Settings are
 * configuration, not tracked data, and are left intact so the app doesn't
 * silently lose Rule setup or the browser-extension pairing token.
 */
export function deleteAllData(db: Database.Database): void {
  const run = db.transaction(() => {
    db.exec(`
      DELETE FROM heartbeats;
      DELETE FROM daily_rollup;
      DELETE FROM overrides;
      DELETE FROM manual_entries;
      DELETE FROM discarded_spans;
    `)
  })
  run()
}
