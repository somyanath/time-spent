import type Database from 'better-sqlite3'
import { ipcMain } from 'electron'
import { createCategory, deleteCategory, listCategories, updateCategory } from './db/categories'
import { getOrComputeDailyRollup } from './db/dailyRollup'
import { createDiscardedSpan } from './db/discardedSpans'
import { createManualEntry, deleteManualEntry } from './db/manualEntries'
import { createOverride, deleteOverride } from './db/overrides'
import { createProject, deleteProject, listProjects, updateProject } from './db/projects'
import { createRule, deleteRule, listRules, reorderRules } from './db/rules'
import { getLocalDayRange } from './dayRange'
import type { Category, ProductivityRating, Rule } from '../shared/category'
import type { DiscardedSpan } from '../shared/discardedSpan'
import type { Span } from '../shared/heartbeat'
import {
  CATEGORIES_CREATE_CHANNEL,
  CATEGORIES_DELETE_CHANNEL,
  CATEGORIES_LIST_CHANNEL,
  CATEGORIES_UPDATE_CHANNEL,
  DISCARDED_SPANS_CREATE_CHANNEL,
  MANUAL_ENTRIES_CREATE_CHANNEL,
  MANUAL_ENTRIES_DELETE_CHANNEL,
  OVERRIDES_CREATE_CHANNEL,
  OVERRIDES_DELETE_CHANNEL,
  PROJECTS_CREATE_CHANNEL,
  PROJECTS_DELETE_CHANNEL,
  PROJECTS_LIST_CHANNEL,
  PROJECTS_UPDATE_CHANNEL,
  RULES_CREATE_CHANNEL,
  RULES_DELETE_CHANNEL,
  RULES_LIST_CHANNEL,
  RULES_REORDER_CHANNEL,
  TODAY_GET_SPANS_CHANNEL,
} from '../shared/ipcChannels'
import type { ManualEntry } from '../shared/manualEntry'
import type { Override } from '../shared/override'
import type { Project } from '../shared/project'

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

  ipcMain.handle(PROJECTS_LIST_CHANNEL, (): Project[] => listProjects(db))
  ipcMain.handle(
    PROJECTS_CREATE_CHANNEL,
    (_event, name: string, client?: string | null): Project => createProject(db, name, client ?? null),
  )
  ipcMain.handle(
    PROJECTS_UPDATE_CHANNEL,
    (_event, id: number, updates: { name?: string; client?: string | null }): void => updateProject(db, id, updates),
  )
  ipcMain.handle(PROJECTS_DELETE_CHANNEL, (_event, id: number): void => deleteProject(db, id))

  ipcMain.handle(RULES_LIST_CHANNEL, (): Rule[] => listRules(db))
  ipcMain.handle(
    RULES_CREATE_CHANNEL,
    (
      _event,
      rule: {
        categoryId: number
        projectId?: number | null
        appPattern?: string | null
        titlePattern?: string | null
        urlPattern?: string | null
      },
    ): Rule => createRule(db, rule),
  )
  ipcMain.handle(RULES_DELETE_CHANNEL, (_event, id: number): void => deleteRule(db, id))
  ipcMain.handle(RULES_REORDER_CHANNEL, (_event, orderedIds: number[]): void => reorderRules(db, orderedIds))

  ipcMain.handle(
    OVERRIDES_CREATE_CHANNEL,
    (
      _event,
      override: { startedAt: number; endedAt: number; categoryId: number; projectId?: number | null },
    ): Override => createOverride(db, override),
  )
  ipcMain.handle(OVERRIDES_DELETE_CHANNEL, (_event, id: number): void => deleteOverride(db, id))

  ipcMain.handle(
    MANUAL_ENTRIES_CREATE_CHANNEL,
    (
      _event,
      entry: { startedAt: number; endedAt: number; label: string; categoryId: number; projectId?: number | null },
    ): ManualEntry => createManualEntry(db, entry),
  )
  ipcMain.handle(MANUAL_ENTRIES_DELETE_CHANNEL, (_event, id: number): void => deleteManualEntry(db, id))

  ipcMain.handle(
    DISCARDED_SPANS_CREATE_CHANNEL,
    (_event, span: { startedAt: number; endedAt: number }): DiscardedSpan => createDiscardedSpan(db, span),
  )
}
