import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { Menu, Tray, app, nativeImage } from 'electron'
import { getWorkModeState } from './db/workMode'
import { openDashboardWindow } from './window'

let tray: Tray | null = null
let refreshInterval: ReturnType<typeof setInterval> | null = null

const REFRESH_INTERVAL_MS = 60_000

function formatWorkModeLabel(db: Database.Database): string {
  const state = getWorkModeState(db, Date.now())
  const status = state.isOn ? 'On' : 'Off'
  const suffix = state.overridden ? ' (manual)' : ''
  const nextChange =
    state.nextChangeAt !== null
      ? ` — next change ${new Date(state.nextChangeAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
      : ''
  return `Work Mode: ${status}${suffix}${nextChange}`
}

/**
 * Create the menu-bar tray. Slice 1's menu is intentionally minimal — just
 * "Open Dashboard" and Quit. Later slices add today's quick stats and the
 * tracking on/off (privacy pause) toggle; #24 adds the effective Work Mode
 * readout, refreshed on a timer since the schedule/override are only
 * evaluated against the current time when the menu is rebuilt.
 */
export function createTray(db: Database.Database): Tray {
  const iconPath = join(app.getAppPath(), 'resources', 'trayTemplate.png')
  const image = nativeImage.createFromPath(iconPath)
  // Template images let macOS recolour the glyph for light/dark menu bars.
  image.setTemplateImage(true)

  tray = new Tray(image)
  tray.setToolTip('Time Tracker')

  function rebuildMenu(): void {
    if (!tray) return
    const menu = Menu.buildFromTemplate([
      { label: formatWorkModeLabel(db), enabled: false },
      { type: 'separator' },
      { label: 'Open Dashboard', click: () => openDashboardWindow() },
      { type: 'separator' },
      { label: 'Quit Time Tracker', role: 'quit' },
    ])
    tray.setContextMenu(menu)
  }

  rebuildMenu()
  refreshInterval = setInterval(rebuildMenu, REFRESH_INTERVAL_MS)

  return tray
}

export function stopTrayRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}
