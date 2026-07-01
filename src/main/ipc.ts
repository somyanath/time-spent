import type Database from 'better-sqlite3'
import { ipcMain } from 'electron'
import { createCategory, deleteCategory, listCategories, updateCategory } from './db/categories'
import { getOrComputeDailyRollup } from './db/dailyRollup'
import { createRule, deleteRule, listRules, reorderRules } from './db/rules'
import { getLocalDayRange } from './dayRange'
import type { Category, ProductivityRating, Rule } from '../shared/category'
import type { Span } from '../shared/heartbeat'
import {
  CATEGORIES_CREATE_CHANNEL,
  CATEGORIES_DELETE_CHANNEL,
  CATEGORIES_LIST_CHANNEL,
  CATEGORIES_UPDATE_CHANNEL,
  RULES_CREATE_CHANNEL,
  RULES_DELETE_CHANNEL,
  RULES_LIST_CHANNEL,
  RULES_REORDER_CHANNEL,
  TODAY_GET_SPANS_CHANNEL,
} from '../shared/ipcChannels'

/** Registers the IPC channels the renderer's preload bridge invokes. */
export function registerIpcHandlers(db: Database.Database): void {
  ipcMain.handle(TODAY_GET_SPANS_CHANNEL, (): Span[] => {
    const now = Date.now()
    const { dateKey, startMs, endMs } = getLocalDayRange(now)
    return getOrComputeDailyRollup(db, { dateKey, startMs, endMs, now })
  })

  ipcMain.handle(CATEGORIES_LIST_CHANNEL, (): Category[] => listCategories(db))
  ipcMain.handle(
    CATEGORIES_CREATE_CHANNEL,
    (_event, name: string, rating: ProductivityRating): Category => createCategory(db, name, rating),
  )
  ipcMain.handle(
    CATEGORIES_UPDATE_CHANNEL,
    (_event, id: number, updates: { name?: string; rating?: ProductivityRating }): void =>
      updateCategory(db, id, updates),
  )
  ipcMain.handle(CATEGORIES_DELETE_CHANNEL, (_event, id: number): void => deleteCategory(db, id))

  ipcMain.handle(RULES_LIST_CHANNEL, (): Rule[] => listRules(db))
  ipcMain.handle(
    RULES_CREATE_CHANNEL,
    (
      _event,
      rule: { categoryId: number; appPattern?: string | null; titlePattern?: string | null; urlPattern?: string | null },
    ): Rule => createRule(db, rule),
  )
  ipcMain.handle(RULES_DELETE_CHANNEL, (_event, id: number): void => deleteRule(db, id))
  ipcMain.handle(RULES_REORDER_CHANNEL, (_event, orderedIds: number[]): void => reorderRules(db, orderedIds))
}
