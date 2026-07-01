import type { Migration } from './types'

/**
 * Lets a Rule assign a Project independently of the Category it assigns
 * (#19) — the same winning Rule can carry both. Nullable: most Rules will
 * still only assign a Category. `ON DELETE SET NULL` so deleting a Project
 * un-assigns it from Rules rather than deleting the Rule itself.
 */
export const addProjectIdToRules: Migration = {
  version: 7,
  name: 'add_project_id_to_rules',
  up: (db) => {
    db.exec(`
      ALTER TABLE rules ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
    `)
  },
}
