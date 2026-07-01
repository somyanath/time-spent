import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDerivationVersion } from './derivationVersion'
import { migrations, runMigrations } from './migrations'
import { createProject, deleteProject, listProjects, updateProject } from './projects'

describe('projects persistence', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, migrations)
  })

  afterEach(() => {
    db.close()
  })

  it('creates a project with a client attribute', () => {
    const project = createProject(db, 'Acme Website', 'Acme Corp')

    expect(project).toEqual(expect.objectContaining({ name: 'Acme Website', client: 'Acme Corp' }))
  })

  it('defaults client to null when not given', () => {
    const project = createProject(db, 'Personal Site')

    expect(project.client).toBeNull()
  })

  it('lists projects alphabetically', () => {
    createProject(db, 'Zeta')
    createProject(db, 'Alpha')

    const projects = listProjects(db)

    expect(projects.map((p) => p.name)).toEqual(['Alpha', 'Zeta'])
  })

  it('bumps the derivation version on create', () => {
    const before = getDerivationVersion(db)

    createProject(db, 'Acme Website')

    expect(getDerivationVersion(db)).toBe(before + 1)
  })

  it('updates a project name and client', () => {
    const project = createProject(db, 'Acme Website', null)

    updateProject(db, project.id, { name: 'Acme Redesign', client: 'Acme Corp' })

    const [updated] = listProjects(db)
    expect(updated).toEqual(expect.objectContaining({ name: 'Acme Redesign', client: 'Acme Corp' }))
  })

  it('bumps the derivation version on update', () => {
    const project = createProject(db, 'Acme Website')
    const before = getDerivationVersion(db)

    updateProject(db, project.id, { name: 'Acme Redesign' })

    expect(getDerivationVersion(db)).toBe(before + 1)
  })

  it('deletes a project', () => {
    const project = createProject(db, 'Acme Website')

    deleteProject(db, project.id)

    expect(listProjects(db)).toEqual([])
  })

  it('bumps the derivation version on delete', () => {
    const project = createProject(db, 'Acme Website')
    const before = getDerivationVersion(db)

    deleteProject(db, project.id)

    expect(getDerivationVersion(db)).toBe(before + 1)
  })
})
