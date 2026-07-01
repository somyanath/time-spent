import type Database from 'better-sqlite3'
import { ipcMain } from 'electron'
import { getOrComputeDailyRollup } from './db/dailyRollup'
import { getLocalDayRange } from './dayRange'
import type { Span } from '../shared/heartbeat'
import { TODAY_GET_SPANS_CHANNEL } from '../shared/ipcChannels'

/** Registers the IPC channels the renderer's preload bridge invokes. */
export function registerIpcHandlers(db: Database.Database): void {
  ipcMain.handle(TODAY_GET_SPANS_CHANNEL, (): Span[] => {
    const now = Date.now()
    const { dateKey, startMs, endMs } = getLocalDayRange(now)
    return getOrComputeDailyRollup(db, { dateKey, startMs, endMs, now })
  })
}
