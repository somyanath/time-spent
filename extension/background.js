// Reports the active tab URL to the Time Tracker app over a localhost
// WebSocket (#22, ADR-0002). Only ever talks to 127.0.0.1 — no external
// network call is made. The per-install token is entered once via the
// extension's options page and stored locally.

const WS_URL = 'ws://127.0.0.1:47923'
const RECONNECT_DELAY_MS = 3000

let socket = null

async function getToken() {
  const { token } = await browser.storage.local.get('token')
  return token || null
}

async function connect() {
  const token = await getToken()
  if (!token) return

  socket = new WebSocket(`${WS_URL}/?token=${encodeURIComponent(token)}`)
  socket.addEventListener('close', () => {
    socket = null
    setTimeout(connect, RECONNECT_DELAY_MS)
  })
  socket.addEventListener('error', () => socket && socket.close())
  socket.addEventListener('open', () => reportActiveTabUrl())
}

function send(url) {
  if (!url || !socket || socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify({ url }))
}

async function reportActiveTabUrl() {
  const [activeTab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  if (activeTab) send(activeTab.url)
}

browser.tabs.onActivated.addListener(reportActiveTabUrl)
browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) send(changeInfo.url)
})
browser.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== browser.windows.WINDOW_ID_NONE) reportActiveTabUrl()
})
browser.storage.onChanged.addListener((changes) => {
  if (changes.token) {
    if (socket) socket.close()
    else void connect()
  }
})

void connect()
