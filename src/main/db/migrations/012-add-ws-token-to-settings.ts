import { randomUUID } from 'node:crypto'
import type { Migration } from './types'

/**
 * A per-install token (#22, ADR-0002) authenticating the browser
 * extension's localhost WebSocket connection: generated once here, at
 * migration time, so it's stable across relaunches without any extra
 * bookkeeping table. The extension is configured with this value out of
 * band (Settings surfaces it for copy-paste); no external network call
 * ever reads or sends it.
 */
export const addWsTokenToSettings: Migration = {
  version: 12,
  name: 'add_ws_token_to_settings',
  up: (db) => {
    db.exec(`ALTER TABLE settings ADD COLUMN ws_token TEXT`)
    db.prepare('UPDATE settings SET ws_token = ? WHERE id = 1').run(randomUUID())
  },
}
