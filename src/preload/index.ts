import { contextBridge, ipcRenderer } from 'electron'
import type { TimeTrackerApi } from '../shared/api'
import {
  CATEGORIES_CREATE_CHANNEL,
  CATEGORIES_DELETE_CHANNEL,
  CATEGORIES_LIST_CHANNEL,
  CATEGORIES_UPDATE_CHANNEL,
  DISCARDED_SPANS_CREATE_CHANNEL,
  GOALS_GET_CONFIG_CHANNEL,
  GOALS_SET_CONFIG_CHANNEL,
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
  TODAY_GET_GOAL_PROGRESS_CHANNEL,
  TODAY_GET_SPANS_CHANNEL,
  WORK_MODE_CLEAR_OVERRIDE_CHANNEL,
  WORK_MODE_GET_STATE_CHANNEL,
  WORK_MODE_GET_WORKING_HOURS_CHANNEL,
  WORK_MODE_SET_OVERRIDE_CHANNEL,
  WORK_MODE_SET_WORKING_HOURS_CHANNEL,
} from '../shared/ipcChannels'

// Context isolation is on, so nothing Node-y leaks into the renderer; we hand it
// exactly one small, typed object backed by ipcRenderer.invoke channels.
const api: TimeTrackerApi = {
  versions: {
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    node: process.versions.node ?? 'unknown',
  },
  getTodaySpans: () => ipcRenderer.invoke(TODAY_GET_SPANS_CHANNEL),
  getTodayFocusQuality: () => ipcRenderer.invoke(TODAY_GET_FOCUS_QUALITY_CHANNEL),
  getTodayGoalProgress: () => ipcRenderer.invoke(TODAY_GET_GOAL_PROGRESS_CHANNEL),

  listCategories: () => ipcRenderer.invoke(CATEGORIES_LIST_CHANNEL),
  createCategory: (name, rating) => ipcRenderer.invoke(CATEGORIES_CREATE_CHANNEL, name, rating),
  updateCategory: (id, updates) => ipcRenderer.invoke(CATEGORIES_UPDATE_CHANNEL, id, updates),
  deleteCategory: (id) => ipcRenderer.invoke(CATEGORIES_DELETE_CHANNEL, id),

  listProjects: () => ipcRenderer.invoke(PROJECTS_LIST_CHANNEL),
  createProject: (name, client) => ipcRenderer.invoke(PROJECTS_CREATE_CHANNEL, name, client),
  updateProject: (id, updates) => ipcRenderer.invoke(PROJECTS_UPDATE_CHANNEL, id, updates),
  deleteProject: (id) => ipcRenderer.invoke(PROJECTS_DELETE_CHANNEL, id),

  listRules: () => ipcRenderer.invoke(RULES_LIST_CHANNEL),
  createRule: (rule) => ipcRenderer.invoke(RULES_CREATE_CHANNEL, rule),
  deleteRule: (id) => ipcRenderer.invoke(RULES_DELETE_CHANNEL, id),
  reorderRules: (orderedIds) => ipcRenderer.invoke(RULES_REORDER_CHANNEL, orderedIds),

  createOverride: (override) => ipcRenderer.invoke(OVERRIDES_CREATE_CHANNEL, override),
  deleteOverride: (id) => ipcRenderer.invoke(OVERRIDES_DELETE_CHANNEL, id),

  createManualEntry: (entry) => ipcRenderer.invoke(MANUAL_ENTRIES_CREATE_CHANNEL, entry),
  deleteManualEntry: (id) => ipcRenderer.invoke(MANUAL_ENTRIES_DELETE_CHANNEL, id),

  createDiscardedSpan: (span) => ipcRenderer.invoke(DISCARDED_SPANS_CREATE_CHANNEL, span),

  getSettings: () => ipcRenderer.invoke(SETTINGS_GET_CHANNEL),
  setAppLevelOnly: (value) => ipcRenderer.invoke(SETTINGS_SET_APP_LEVEL_ONLY_CHANNEL, value),

  getGoalsConfig: () => ipcRenderer.invoke(GOALS_GET_CONFIG_CHANNEL),
  setGoalsConfig: (config) => ipcRenderer.invoke(GOALS_SET_CONFIG_CHANNEL, config),

  getWorkModeState: () => ipcRenderer.invoke(WORK_MODE_GET_STATE_CHANNEL),
  getWorkingHours: () => ipcRenderer.invoke(WORK_MODE_GET_WORKING_HOURS_CHANNEL),
  setWorkingHours: (schedule) => ipcRenderer.invoke(WORK_MODE_SET_WORKING_HOURS_CHANNEL, schedule),
  setWorkModeOverride: (value) => ipcRenderer.invoke(WORK_MODE_SET_OVERRIDE_CHANNEL, value),
  clearWorkModeOverride: () => ipcRenderer.invoke(WORK_MODE_CLEAR_OVERRIDE_CHANNEL),

  getPermissionsStatus: () => ipcRenderer.invoke(PERMISSIONS_GET_STATUS_CHANNEL),
  requestScreenRecordingAccess: () => ipcRenderer.invoke(PERMISSIONS_REQUEST_SCREEN_RECORDING_CHANNEL),
  openScreenRecordingSettings: () => ipcRenderer.invoke(PERMISSIONS_OPEN_SCREEN_RECORDING_SETTINGS_CHANNEL),
}

contextBridge.exposeInMainWorld('timeTracker', api)
