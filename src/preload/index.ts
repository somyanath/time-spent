import { contextBridge, ipcRenderer } from 'electron'
import type { TimeTrackerApi } from '../shared/api'
import { TODAY_GET_SPANS_CHANNEL } from '../shared/ipcChannels'

// Context isolation is on, so nothing Node-y leaks into the renderer; we hand it
// exactly one small, typed object backed by ipcRenderer.invoke channels.
const api: TimeTrackerApi = {
  versions: {
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    node: process.versions.node ?? 'unknown',
  },
  getTodaySpans: () => ipcRenderer.invoke(TODAY_GET_SPANS_CHANNEL),
}

contextBridge.exposeInMainWorld('timeTracker', api)
