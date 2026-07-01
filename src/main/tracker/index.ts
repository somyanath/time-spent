import type Database from 'better-sqlite3'
import { powerMonitor } from 'electron'
import { insertHeartbeats } from '../db/heartbeats'
import { ActiveWinHeartbeatSource } from './activeWinSource'
import { HeartbeatTracker } from './heartbeatTracker'

const FLUSH_INTERVAL_MS = 15_000

export interface TrackingController {
  stop(): void
}

/**
 * Wires the impure edges together: the tracker loop consumes the
 * HeartbeatSource (debounce/batch), a periodic flush persists completed
 * Heartbeats, and sleep/lock close the open span so sleep is never counted
 * as activity.
 */
export function startTracking(db: Database.Database): TrackingController {
  const tracker = new HeartbeatTracker({
    persist: (heartbeats) => insertHeartbeats(db, heartbeats),
  })
  const source = new ActiveWinHeartbeatSource()

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
    },
  }
}
