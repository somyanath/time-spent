import type { Migration } from './types'

/**
 * Projects: "what was this time for," orthogonal to Category (#18). `client`
 * is an attribute of the Project, not a separate level.
 */
export const createProjects: Migration = {
  version: 6,
  name: 'create_projects',
  up: (db) => {
    db.exec(`
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        client TEXT
      );
    `)
  },
}
