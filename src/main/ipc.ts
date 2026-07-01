import type Database from 'better-sqlite3'
import { ipcMain } from 'electron'
import { createCategory, deleteCategory, listCategories, updateCategory } from './db/categories'
import { getOrComputeDailyRollup } from './db/dailyRollup'
import { createDiscardedSpan } from './db/discardedSpans'
import { getFocusQuality } from './db/focusQuality'
import type { FocusQualityResult } from './db/focusQuality'
import { getRecentHeartbeats } from './db/heartbeats'
import { createManualEntry, deleteManualEntry } from './db/manualEntries'
import { createOverride, deleteOverride } from './db/overrides'
import { createProject, deleteProject, listProjects, updateProject } from './db/projects'
import { createRule, deleteRule, listRules, reorderRules } from './db/rules'
import { getSettings, setAppLevelOnly } from './db/settings'
import {
  clearWorkModeOverride,
  getWorkingHours,
  getWorkModeState,
  setWorkingHours,
  setWorkModeOverride,
} from './db/workMode'
import { getLocalDayRange } from './dayRange'
import { getScreenRecordingStatus, openScreenRecordingSettings, requestScreenRecordingAccess } from './permissions'
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
  PERMISSIONS_GET_STATUS_CHANNEL,
  PERMISSIONS_OPEN_SCREEN_RECORDING_SETTINGS_CHANNEL,
  PERMISSIONS_REQUEST_SCREEN_RECORDING_CHANNEL,
  PROJECTS_CREATE_CHANNEL,
  PROJECTS_DELETE_CHANNEL,
  PROJECTS_LIST_CHANNEL,
  PROJECTS_UPDATE_CHANNEL,
  RULES_CREATE_CHANNEL,
  RULES_DELETE_CHANNEL,
  RULES_LIST_CHANNEL,
  RULES_REORDER_CHANNEL,
  SETTINGS_GET_CHANNEL,
  SETTINGS_SET_APP_LEVEL_ONLY_CHANNEL,
  TODAY_GET_FOCUS_QUALITY_CHANNEL,
  TODAY_GET_SPANS_CHANNEL,
  WORK_MODE_CLEAR_OVERRIDE_CHANNEL,
  WORK_MODE_GET_STATE_CHANNEL,
  WORK_MODE_GET_WORKING_HOURS_CHANNEL,
  WORK_MODE_SET_OVERRIDE_CHANNEL,
  WORK_MODE_SET_WORKING_HOURS_CHANNEL,
} from '../shared/ipcChannels'
import type { ManualEntry } from '../shared/manualEntry'
import type { Override } from '../shared/override'
import { detectSilentPermissionLapse } from '../shared/permissions'
import type { AppSettings, PermissionsStatus } from '../shared/permissions'
import type { Project } from '../shared/project'
import type { WorkingHoursSchedule, WorkModeState } from '../shared/workMode'

const LAPSE_CHECK_SAMPLE_SIZE = 5

/** Registers the IPC channels the renderer's preload bridge invokes. */
export function registerIpcHandlers(db: Database.Database): void {
  ipcMain.handle(TODAY_GET_SPANS_CHANNEL, (): Span[] => {
    const now = Date.now()
    const { dateKey, startMs, endMs } = getLocalDayRange(now)
    return getOrComputeDailyRollup(db, { dateKey, startMs, endMs, now })
  })

  ipcMain.handle(TODAY_GET_FOCUS_QUALITY_CHANNEL, (): FocusQualityResult => {
    const now = Date.now()
    const { startMs, endMs } = getLocalDayRange(now)
    return getFocusQuality(db, { startMs, endMs, now })
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

  ipcMain.handle(SETTINGS_GET_CHANNEL, (): AppSettings => getSettings(db))
  ipcMain.handle(
    SETTINGS_SET_APP_LEVEL_ONLY_CHANNEL,
    (_event, value: boolean): AppSettings => setAppLevelOnly(db, value),
  )

  ipcMain.handle(WORK_MODE_GET_STATE_CHANNEL, (): WorkModeState => getWorkModeState(db, Date.now()))
  ipcMain.handle(WORK_MODE_GET_WORKING_HOURS_CHANNEL, (): WorkingHoursSchedule => getWorkingHours(db))
  ipcMain.handle(
    WORK_MODE_SET_WORKING_HOURS_CHANNEL,
    (_event, schedule: WorkingHoursSchedule): WorkingHoursSchedule => setWorkingHours(db, schedule),
  )
  ipcMain.handle(WORK_MODE_SET_OVERRIDE_CHANNEL, (_event, value: boolean): WorkModeState => {
    setWorkModeOverride(db, value, Date.now())
    return getWorkModeState(db, Date.now())
  })
  ipcMain.handle(WORK_MODE_CLEAR_OVERRIDE_CHANNEL, (): WorkModeState => {
    clearWorkModeOverride(db)
    return getWorkModeState(db, Date.now())
  })

  ipcMain.handle(PERMISSIONS_GET_STATUS_CHANNEL, (): PermissionsStatus => {
    const { appLevelOnly } = getSettings(db)
    const recentHeartbeats = getRecentHeartbeats(db, LAPSE_CHECK_SAMPLE_SIZE)
    return {
      appLevelOnly,
      screenRecordingStatus: getScreenRecordingStatus(),
      silentLapseDetected: detectSilentPermissionLapse(recentHeartbeats, {
        appLevelOnly,
        minSampleSize: LAPSE_CHECK_SAMPLE_SIZE,
      }),
    }
  })
  ipcMain.handle(PERMISSIONS_REQUEST_SCREEN_RECORDING_CHANNEL, (): void => requestScreenRecordingAccess())
  ipcMain.handle(PERMISSIONS_OPEN_SCREEN_RECORDING_SETTINGS_CHANNEL, (): Promise<void> => openScreenRecordingSettings())
}
