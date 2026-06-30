import { join } from 'node:path'
import { app, Menu, Tray, nativeImage } from 'electron'
import { openDashboard } from './window'

let tray: Tray | null = null

/**
 * Creates the menu-bar tray. v1 of the skeleton carries a single action —
 * "Open Dashboard" — which the later slices grow into quick stats, the
 * tracking on/off toggle, and the Work Mode override.
 */
export function createTray(): Tray {
  const iconPath = join(app.getAppPath(), 'resources', 'trayTemplate.png')
  const icon = nativeImage.createFromPath(iconPath)
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('Time Tracker')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => openDashboard()
    },
    { type: 'separator' },
    {
      label: 'Quit Time Tracker',
      role: 'quit'
    }
  ])
  tray.setContextMenu(menu)

  return tray
}
