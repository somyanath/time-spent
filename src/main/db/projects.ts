import type Database from 'better-sqlite3'
import { bumpDerivationVersion } from './derivationVersion'
import type { Project } from '../../shared/project'

export function listProjects(db: Database.Database): Project[] {
  return db.prepare('SELECT id, name, client FROM projects ORDER BY name ASC').all() as Project[]
}

export function createProject(db: Database.Database, name: string, client: string | null = null): Project {
  let id = 0
  db.transaction(() => {
    const result = db.prepare('INSERT INTO projects (name, client) VALUES (?, ?)').run(name, client)
    id = result.lastInsertRowid as number
    bumpDerivationVersion(db)
  })()
  return { id, name, client }
}

export function updateProject(db: Database.Database, id: number, updates: { name?: string; client?: string | null }): void {
  db.transaction(() => {
    if (updates.name !== undefined) {
      db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(updates.name, id)
    }
    if (updates.client !== undefined) {
      db.prepare('UPDATE projects SET client = ? WHERE id = ?').run(updates.client, id)
    }
    bumpDerivationVersion(db)
  })()
}

/** Deleting a Project un-assigns it from any Rules that reference it (`ON DELETE SET NULL`), it does not delete the Rules. */
export function deleteProject(db: Database.Database, id: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    bumpDerivationVersion(db)
  })()
}
