import { join } from 'node:path'
import { Menu, Tray, app, nativeImage } from 'electron'
import { openDashboardWindow } from './window'

let tray: Tray | null = null

/**
 * Create the menu-bar tray. Slice 1's menu is intentionally minimal — just
 * "Open Dashboard" and Quit. Later slices add today's quick stats, the tracking
 * on/off (privacy pause) toggle, and the Work Mode override.
 */
export function createTray(): Tray {
  const iconPath = join(app.getAppPath(), 'resources', 'trayTemplate.png')
  const image = nativeImage.createFromPath(iconPath)
  // Template images let macOS recolour the glyph for light/dark menu bars.
  image.setTemplateImage(true)

  tray = new Tray(image)
  tray.setToolTip('Time Tracker')

  const menu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: () => openDashboardWindow() },
    { type: 'separator' },
    { label: 'Quit Time Tracker', role: 'quit' },
  ])
  tray.setContextMenu(menu)

  return tray
}
