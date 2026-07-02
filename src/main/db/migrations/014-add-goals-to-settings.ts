import type { Migration } from './types'

/**
 * Daily Goals (#27): the Focus target (aspirational) and Overwork ceiling
 * (protective) are user-set, so they default to unset (NULL) rather than a
 * built-in value — a null column means that goal, and its notification,
 * stays off until the user opts in from Settings.
 */
export const addGoalsToSettings: Migration = {
  version: 14,
  name: 'add_goals_to_settings',
  up: (db) => {
    db.exec(`
      ALTER TABLE settings ADD COLUMN focus_target_ms INTEGER;
      ALTER TABLE settings ADD COLUMN overwork_ceiling_ms INTEGER;
    `)
  },
}
