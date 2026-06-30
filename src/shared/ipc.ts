/**
 * Types shared across the process boundary (main ⇄ preload ⇄ renderer).
 * Keep this module free of Electron and Node imports so both sides can use it.
 */

/** IPC channel names, centralized so main and preload can't drift. */
export const IpcChannel = {
  dbStatus: 'db:status'
} as const

export interface DbStatus {
  /** Absolute path to the SQLite file under the app support directory. */
  path: string
  /** Highest applied migration version (0 when the schema is empty). */
  schemaVersion: number
  /** Whether the database connection is currently open. */
  open: boolean
}

/** API surfaced to the renderer on `window.api`. */
export interface RendererApi {
  getDbStatus: () => Promise<DbStatus>
}
