import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'

export interface ExtensionUrlServerOptions {
  /** Per-install token the extension must present; foreign/unauthenticated connections are rejected. */
  token: string
  /** Only URLs reported within this window count as "fresh" (resolveUrlSource's `hasFreshExtensionUrl`). */
  maxAgeMs?: number
  port?: number
}

const DEFAULT_MAX_AGE_MS = 10_000

/**
 * The localhost transport for the browser WebExtension (#22, ADR-0002): a
 * WebSocket server bound to 127.0.0.1 only, so nothing off-machine can reach
 * it. The extension authenticates by passing the per-install token as a
 * `token` query param on the connection URL; any other connection is closed
 * immediately without being read. The server does no outbound networking —
 * it only accepts what a local client sends it.
 */
export class ExtensionUrlServer {
  private readonly token: string
  private readonly maxAgeMs: number
  private readonly requestedPort: number
  private httpServer: Server | null = null
  private wss: WebSocketServer | null = null
  private latestUrl: string | null = null
  private latestReportedAt: number | null = null

  constructor(options: ExtensionUrlServerOptions) {
    this.token = options.token
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS
    this.requestedPort = options.port ?? 0
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      const httpServer = createServer()
      const wss = new WebSocketServer({ server: httpServer })

      wss.on('connection', (socket, request) => {
        const url = new URL(request.url ?? '', 'http://127.0.0.1')
        if (url.searchParams.get('token') !== this.token) {
          socket.close(1008, 'unauthorized')
          return
        }

        socket.on('message', (data) => {
          this.handleMessage(data.toString())
        })
      })

      httpServer.once('error', reject)
      // 127.0.0.1 only (not 0.0.0.0) — no external network can ever reach this port.
      httpServer.listen(this.requestedPort, '127.0.0.1', () => {
        this.httpServer = httpServer
        this.wss = wss
        const address = httpServer.address()
        resolve(typeof address === 'object' && address ? address.port : this.requestedPort)
      })
    })
  }

  stop(): void {
    this.wss?.close()
    this.httpServer?.close()
    this.wss = null
    this.httpServer = null
  }

  /** The most recent URL the extension reported, or null if none has arrived within maxAgeMs. */
  getUrl(now: number = Date.now()): string | null {
    if (this.latestReportedAt === null) return null
    if (now - this.latestReportedAt > this.maxAgeMs) return null
    return this.latestUrl
  }

  private handleMessage(raw: string): void {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'url' in parsed &&
        typeof (parsed as { url: unknown }).url === 'string'
      ) {
        this.latestUrl = (parsed as { url: string }).url
        this.latestReportedAt = Date.now()
      }
    } catch {
      // Malformed message from a misbehaving client — ignore it, keep the last-known-good URL.
    }
  }
}
