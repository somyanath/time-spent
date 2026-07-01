import type { Migration } from './types'

/**
 * A single-row app settings table. Ships with `app_level_only` (#21): when
 * on, the tracker never requests the Screen Recording grant and Heartbeats
 * carry no window title, even if the grant happens to be present.
 */
export const createSettings: Migration = {
  version: 11,
  name: 'create_settings',
  up: (db) => {
    db.exec(`
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        app_level_only INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO settings (id, app_level_only) VALUES (1, 0);
    `)
  },
}
