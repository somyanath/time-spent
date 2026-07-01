import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { ExtensionUrlServer } from './extensionUrlServer'

const TOKEN = 'test-token-abc'

function connect(port: number, token?: string): WebSocket {
  const query = token === undefined ? '' : `?token=${token}`
  return new WebSocket(`ws://127.0.0.1:${port}${query}`)
}

function onceOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve())
    socket.once('error', reject)
  })
}

function onceClose(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    socket.once('close', (code) => resolve(code))
  })
}

describe('ExtensionUrlServer', () => {
  let server: ExtensionUrlServer | null = null
  let sockets: WebSocket[] = []

  afterEach(() => {
    for (const socket of sockets) socket.close()
    sockets = []
    server?.stop()
    server = null
  })

  it('rejects a connection with no token', async () => {
    server = new ExtensionUrlServer({ token: TOKEN })
    const port = await server.start()

    const socket = connect(port)
    sockets.push(socket)
    const code = await onceClose(socket)

    expect(code).toBe(1008)
  })

  it('rejects a connection with the wrong token', async () => {
    server = new ExtensionUrlServer({ token: TOKEN })
    const port = await server.start()

    const socket = connect(port, 'wrong-token')
    sockets.push(socket)
    const code = await onceClose(socket)

    expect(code).toBe(1008)
  })

  it('accepts a connection with the correct token and records the reported URL', async () => {
    server = new ExtensionUrlServer({ token: TOKEN })
    const port = await server.start()

    const socket = connect(port, TOKEN)
    sockets.push(socket)
    await onceOpen(socket)
    socket.send(JSON.stringify({ url: 'https://example.com/inbox' }))

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(server.getUrl()).toBe('https://example.com/inbox')
  })

  it('treats a URL older than maxAgeMs as stale', async () => {
    server = new ExtensionUrlServer({ token: TOKEN, maxAgeMs: 50 })
    const port = await server.start()

    const socket = connect(port, TOKEN)
    sockets.push(socket)
    await onceOpen(socket)
    socket.send(JSON.stringify({ url: 'https://example.com/inbox' }))
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(server.getUrl()).toBe('https://example.com/inbox')

    await new Promise((resolve) => setTimeout(resolve, 60))

    expect(server.getUrl()).toBeNull()
  })

  it('ignores malformed messages without dropping the last-known-good URL', async () => {
    server = new ExtensionUrlServer({ token: TOKEN })
    const port = await server.start()

    const socket = connect(port, TOKEN)
    sockets.push(socket)
    await onceOpen(socket)
    socket.send(JSON.stringify({ url: 'https://example.com/inbox' }))
    await new Promise((resolve) => setTimeout(resolve, 20))
    socket.send('not json')
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(server.getUrl()).toBe('https://example.com/inbox')
  })
})
