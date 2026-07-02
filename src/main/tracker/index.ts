import type Database from 'better-sqlite3'
import { powerMonitor } from 'electron'
import { insertHeartbeats } from '../db/heartbeats'
import { getSettings } from '../db/settings'
import { ActiveWinHeartbeatSource } from './activeWinSource'
import { ExtensionUrlServer } from './extensionUrlServer'
import { HeartbeatTracker } from './heartbeatTracker'
import { createUrlResolver } from './urlResolver'

const FLUSH_INTERVAL_MS = 15_000
/** Fixed so the WebExtension can be configured with a known endpoint (#22). */
const EXTENSION_WS_PORT = 47_923

export interface TrackingController {
  stop(): void
}

/**
 * Wires the impure edges together: the tracker loop consumes the
 * HeartbeatSource (debounce/batch), a periodic flush persists completed
 * Heartbeats, and sleep/lock close the open span so sleep is never counted
 * as activity. Also starts the localhost extension URL server (#22) so
 * `resolveUrl` has a live Extension source to prefer over AppleScript.
 */
export function startTracking(db: Database.Database): TrackingController {
  const tracker = new HeartbeatTracker({
    persist: (heartbeats) => insertHeartbeats(db, heartbeats),
    // Read fresh on every poll so the tray's privacy-pause toggle (#30) takes
    // effect on the next tick, no restart required.
    isPaused: () => getSettings(db).trackingPaused,
  })

  const extensionUrlServer = new ExtensionUrlServer({ token: getSettings(db).wsToken, port: EXTENSION_WS_PORT })
  void extensionUrlServer.start().catch((error) => {
    console.error('[tracker] extension URL server failed to start', error)
  })

  // Read fresh on every poll so toggling App-level-only mode (#21) in
  // Settings takes effect on the next tick, no restart required.
  const source = new ActiveWinHeartbeatSource({
    isAppLevelOnly: () => getSettings(db).appLevelOnly,
    resolveUrl: createUrlResolver({ getExtensionUrl: () => extensionUrlServer.getUrl() }),
  })

  source.start((observation) => tracker.handleObservation(observation))
  const flushTimer = setInterval(() => tracker.flush(), FLUSH_INTERVAL_MS)

  const onSystemSuspend = (): void => tracker.handleSystemSuspend()
  powerMonitor.on('suspend', onSystemSuspend)
  powerMonitor.on('lock-screen', onSystemSuspend)

  return {
    stop(): void {
      source.stop()
      clearInterval(flushTimer)
      powerMonitor.off('suspend', onSystemSuspend)
      powerMonitor.off('lock-screen', onSystemSuspend)
      tracker.flush()
      extensionUrlServer.stop()
    },
  }
}
