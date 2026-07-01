import type Database from 'better-sqlite3'
import type { AppSettings } from '../../shared/permissions'

export function getSettings(db: Database.Database): AppSettings {
  const row = db
    .prepare('SELECT app_level_only AS appLevelOnly, ws_token AS wsToken FROM settings WHERE id = 1')
    .get() as {
    appLevelOnly: number
    wsToken: string
  }
  return { appLevelOnly: row.appLevelOnly === 1, wsToken: row.wsToken }
}

/** Toggling back on re-requests the Screen Recording grant on the next poll (activeWinSource.ts). */
export function setAppLevelOnly(db: Database.Database, value: boolean): AppSettings {
  db.prepare('UPDATE settings SET app_level_only = ? WHERE id = 1').run(value ? 1 : 0)
  return getSettings(db)
}
