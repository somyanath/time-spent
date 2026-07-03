// Reports the active tab URL to the Time Tracker app over a localhost
// WebSocket (#22/#33, ADR-0002). Only ever talks to 127.0.0.1 — no external
// network call is made. The per-install token is entered once via the
// extension's options page and stored locally.
//
// Shared between the Chromium (service worker) and Firefox (event page)
// builds via webextension-polyfill, so `browser.*` behaves the same on both.

import browser from 'webextension-polyfill'

const WS_URL = 'ws://127.0.0.1:47923'
const RECONNECT_DELAY_MS = 3000

let socket: WebSocket | null = null

async function getToken(): Promise<string | null> {
  const { token } = await browser.storage.local.get('token')
  return typeof token === 'string' ? token : null
}

async function connect(): Promise<void> {
  const token = await getToken()
  if (!token) return

  socket = new WebSocket(`${WS_URL}/?token=${encodeURIComponent(token)}`)
  socket.addEventListener('close', () => {
    socket = null
    setTimeout(() => void connect(), RECONNECT_DELAY_MS)
  })
  socket.addEventListener('error', () => socket?.close())
  socket.addEventListener('open', () => void reportActiveTabUrl())
}

function send(url: string | undefined): void {
  if (!url || !socket || socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify({ url }))
}

async function reportActiveTabUrl(): Promise<void> {
  const [activeTab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  if (activeTab) send(activeTab.url)
}

browser.tabs.onActivated.addListener(() => void reportActiveTabUrl())
browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) send(changeInfo.url)
})
browser.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== browser.windows.WINDOW_ID_NONE) void reportActiveTabUrl()
})
browser.storage.onChanged.addListener((changes) => {
  if (changes.token) {
    if (socket) socket.close()
    else void connect()
  }
})

void connect()
