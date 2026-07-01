import { contextBridge } from 'electron'
import type { TimeTrackerApi } from '../shared/api'

// Context isolation is on, so nothing Node-y leaks into the renderer; we hand it
// exactly one small, typed object. Later slices extend this with ipcRenderer
// channels for heartbeats and derived state.
const api: TimeTrackerApi = {
  versions: {
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    node: process.versions.node ?? 'unknown',
  },
}

contextBridge.exposeInMainWorld('timeTracker', api)
