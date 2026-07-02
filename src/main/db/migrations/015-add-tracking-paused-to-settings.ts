import type { Migration } from './types'

/**
 * The tray's privacy-pause toggle (#30): when on, the tracker drops every
 * Observation instead of turning it into a Heartbeat, so Heartbeat
 * collection halts entirely until the user flips it back off.
 */
export const addTrackingPausedToSettings: Migration = {
  version: 15,
  name: 'add_tracking_paused_to_settings',
  up: (db) => {
    db.exec(`
      ALTER TABLE settings ADD COLUMN tracking_paused INTEGER NOT NULL DEFAULT 0;
    `)
  },
}
