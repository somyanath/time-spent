import { join } from 'node:path'
import { app, dialog, ipcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import { openDatabase } from './db'
import type { MigrationResult } from './db'
import { createTray } from './tray'
import { openDashboard } from './window'
import { IpcChannel, type DbStatus } from '../shared/ipc'

app.setName('Time Tracker')

let db: Database | null = null
let migration: MigrationResult | null = null
let dbPath = ''

function initDatabase(): void {
  // Persist under ~/Library/Application Support/<app>/ (ADR-0001, ADR-0003).
  dbPath = join(app.getPath('userData'), 'time-tracker.db')
  const opened = openDatabase(dbPath)
  db = opened.db
  migration = opened.migration
}

function registerIpc(): void {
  ipcMain.handle(IpcChannel.dbStatus, (): DbStatus => {
    return {
      path: dbPath,
      schemaVersion: migration?.currentVersion ?? 0,
      open: db?.open ?? false
    }
  })
}

// Menu-bar agent: no Dock icon. In dev (unpackaged) `app.dock.hide()` is the
// only lever — there is no Info.plist. The `LSUIElement` key lands with the
// packaging slice (M6); it pins this same behavior for the built .app.
app.dock?.hide()

app.whenReady().then(start).catch(handleFatal)

function start(): void {
  try {
    initDatabase()
    registerIpc()
    createTray()
    // The dashboard opens from the tray; show it once on first launch so the
    // skeleton is visibly alive end-to-end.
    openDashboard()
  } catch (err) {
    handleFatal(err)
  }
}

// A failure to open the DB or run migrations would otherwise leave the agent
// running with no tray and no error — surface it and quit instead.
function handleFatal(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.error('Fatal startup error:', err)
  dialog.showErrorBox('Time Tracker failed to start', message)
  app.quit()
}

// Keep running as a menu-bar agent when all windows are closed.
app.on('window-all-closed', () => {
  // Intentionally do not quit — the tracker lives in the menu bar.
})

app.on('before-quit', () => {
  db?.close()
})
