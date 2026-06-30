import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type DbStatus, type RendererApi } from '../shared/ipc'

const api: RendererApi = {
  getDbStatus: (): Promise<DbStatus> => ipcRenderer.invoke(IpcChannel.dbStatus)
}

contextBridge.exposeInMainWorld('api', api)
