import { join } from 'node:path'
import type BetterSqlite3 from 'better-sqlite3'
import { app } from 'electron'
import { openDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { startTracking } from './tracker'
import type { TrackingController } from './tracker'
import { createTray, stopTrayRefresh } from './tray'

// Stable app identity → a stable `~/Library/Application Support/<app>/` folder
// (and, once signed, stable TCC permission grants across rebuilds). Must be set
// before any getPath('userData') read.
app.setName('time-tracker')

let db: BetterSqlite3.Database | null = null
let tracking: TrackingController | null = null

// As a menu-bar agent the app has no windows for long stretches. Closing the
// dashboard must not quit it — the tray is home; quit happens from the tray.
app.on('window-all-closed', () => {
  // Intentionally empty: stay resident in the menu bar.
})

app.whenReady().then(() => {
  // Menu-bar agent: no Dock icon. Packaging sets LSUIElement in the plist too,
  // but hiding the Dock here makes `pnpm dev` behave identically.
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  const dbPath = join(app.getPath('userData'), 'timetracker.db')
  const opened = openDatabase(dbPath)
  db = opened.db
  const { appliedVersions, currentVersion } = opened.migration
  const appliedNote = appliedVersions.length
    ? `, applied migration(s) ${appliedVersions.join(', ')}`
    : ' (no pending migrations)'
  console.log(`[db] opened ${dbPath} — schema v${currentVersion}${appliedNote}`)

  registerIpcHandlers(db)
  tracking = startTracking(db)
  console.log('[tracker] passive tracking started')

  createTray(db)
  console.log('[tray] menu-bar agent ready')
})

app.on('before-quit', () => {
  stopTrayRefresh()
  tracking?.stop()
  tracking = null
  db?.close()
  db = null
})
