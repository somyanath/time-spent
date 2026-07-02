import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { Menu, Tray, app, nativeImage } from 'electron'
import { getLocalDayRange } from './dayRange'
import { getFocusQuality } from './db/focusQuality'
import { getGoalProgress } from './db/goalProgress'
import { getSettings, setTrackingPaused } from './db/settings'
import { clearWorkModeOverride, getWorkModeState, setWorkModeOverride } from './db/workMode'
import { isLaunchAtLoginEnabled, setLaunchAtLoginEnabled } from './loginItem'
import { openDashboardWindow } from './window'

let tray: Tray | null = null
let refreshInterval: ReturnType<typeof setInterval> | null = null

const REFRESH_INTERVAL_MS = 60_000

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

function formatQuickStatsLabel(db: Database.Database): string {
  const now = Date.now()
  const { startMs, endMs } = getLocalDayRange(now)
  const { score } = getFocusQuality(db, { startMs, endMs, now })
  const { focusAccumulatedMs } = getGoalProgress(db, { startMs, endMs, now })
  return `Today: ${formatDuration(focusAccumulatedMs)} focus · Score ${score}`
}

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
 * Create the menu-bar tray (#30): today's quick stats, the tracking on/off
 * (privacy pause) toggle, the Work Mode override, launch-at-login, and Open
 * Dashboard. Rebuilt on a timer since the schedule/override/score are only
 * evaluated against the current time when the menu is rebuilt, and
 * immediately after any toggle here so the click feels instant.
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
    const workModeState = getWorkModeState(db, Date.now())
    const menu = Menu.buildFromTemplate([
      { label: formatQuickStatsLabel(db), enabled: false },
      { type: 'separator' },
      { label: formatWorkModeLabel(db), enabled: false },
      {
        label: 'Force On',
        type: 'checkbox',
        checked: workModeState.overridden && workModeState.isOn,
        click: () => {
          setWorkModeOverride(db, true, Date.now())
          rebuildMenu()
        },
      },
      {
        label: 'Force Off',
        type: 'checkbox',
        checked: workModeState.overridden && !workModeState.isOn,
        click: () => {
          setWorkModeOverride(db, false, Date.now())
          rebuildMenu()
        },
      },
      ...(workModeState.overridden
        ? [
            {
              label: 'Clear Work Mode Override',
              click: () => {
                clearWorkModeOverride(db)
                rebuildMenu()
              },
            },
          ]
        : []),
      { type: 'separator' },
      {
        label: 'Tracking Enabled',
        type: 'checkbox',
        checked: !getSettings(db).trackingPaused,
        click: () => {
          setTrackingPaused(db, !getSettings(db).trackingPaused)
          rebuildMenu()
        },
      },
      {
        label: 'Launch at Login',
        type: 'checkbox',
        checked: isLaunchAtLoginEnabled(),
        click: () => {
          setLaunchAtLoginEnabled(!isLaunchAtLoginEnabled())
          rebuildMenu()
        },
      },
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
