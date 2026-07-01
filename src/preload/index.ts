import { contextBridge, ipcRenderer } from 'electron'
import type { TimeTrackerApi } from '../shared/api'
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

// Context isolation is on, so nothing Node-y leaks into the renderer; we hand it
// exactly one small, typed object backed by ipcRenderer.invoke channels.
const api: TimeTrackerApi = {
  versions: {
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    node: process.versions.node ?? 'unknown',
  },
  getTodaySpans: () => ipcRenderer.invoke(TODAY_GET_SPANS_CHANNEL),

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
}

contextBridge.exposeInMainWorld('timeTracker', api)
