import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'

let dashboardWindow: BrowserWindow | null = null

/** Only http/https URLs are safe to hand to the OS via shell.openExternal. */
function isExternalHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Open the dashboard window, or focus the existing one. The renderer's default
 * landing surface is the empty **Today** view. There is only ever one dashboard
 * window; the app otherwise lives in the menu bar.
 */
export function openDashboardWindow(): BrowserWindow {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    if (dashboardWindow.isMinimized()) dashboardWindow.restore()
    dashboardWindow.show()
    dashboardWindow.focus()
    return dashboardWindow
  }

  const win = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'Time Tracker',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Show only once painted to avoid a white flash.
  win.once('ready-to-show', () => win.show())

  // New windows never open in-app: send only http(s) links to the user's
  // browser, and deny everything else (file:, custom schemes, etc.).
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Lock the top frame to app content (the bundled file, or the dev server URL).
  // Anything else is treated as an external link, not an in-app navigation.
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (devUrl && url.startsWith(devUrl)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    dashboardWindow = null
  })

  dashboardWindow = win
  return win
}
