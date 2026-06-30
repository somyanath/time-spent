import { join } from 'node:path'
import { BrowserWindow } from 'electron'

let dashboardWindow: BrowserWindow | null = null

/**
 * Opens the dashboard window, creating it on first call and re-using it
 * afterwards. The window hosts the React renderer; its default surface is the
 * empty **Today** view (the daily-review landing).
 */
export function openDashboard(): BrowserWindow {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    if (dashboardWindow.isMinimized()) dashboardWindow.restore()
    dashboardWindow.show()
    dashboardWindow.focus()
    return dashboardWindow
  }

  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'Time Tracker',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Keep the renderer locked down: the preload only needs contextBridge +
      // ipcRenderer, both available to a sandboxed renderer.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    dashboardWindow = null
  })

  // electron-vite serves the renderer over HTTP in dev and writes a static
  // build for production.
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  dashboardWindow = win
  return win
}
