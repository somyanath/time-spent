import type { Migration } from './types'

/**
 * Work Mode (#24): the per-weekday Working Hours schedule is stored as JSON
 * (its shape is `WorkingHoursSchedule` — a small, rarely-queried config blob,
 * not a candidate for the append-only/derived-on-read heartbeat schema). The
 * manual override is a value + the moment it was set, so `derive()` can
 * compute when it expires (the next scheduled boundary) instead of storing
 * an expiry itself.
 */
export const addWorkModeToSettings: Migration = {
  version: 13,
  name: 'add_work_mode_to_settings',
  up: (db) => {
    db.exec(`
      ALTER TABLE settings ADD COLUMN working_hours_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE settings ADD COLUMN work_mode_override INTEGER;
      ALTER TABLE settings ADD COLUMN work_mode_override_set_at INTEGER;
    `)
  },
}
