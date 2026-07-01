import type Database from 'better-sqlite3'
import { bumpDerivationVersion } from './derivationVersion'
import type { Rule } from '../../shared/category'

interface RuleRow {
  id: number
  categoryId: number
  projectId: number | null
  position: number
  appPattern: string | null
  titlePattern: string | null
  urlPattern: string | null
}

/** Ordered by `position` ascending — the same priority order `derive()` applies. */
export function listRules(db: Database.Database): Rule[] {
  return db
    .prepare(
      `
      SELECT
        id,
        category_id AS categoryId,
        project_id AS projectId,
        position,
        app_pattern AS appPattern,
        title_pattern AS titlePattern,
        url_pattern AS urlPattern
      FROM rules
      ORDER BY position ASC
    `,
    )
    .all() as RuleRow[]
}

export interface NewRule {
  categoryId: number
  projectId?: number | null
  appPattern?: string | null
  titlePattern?: string | null
  urlPattern?: string | null
}

/** Appends the Rule at the lowest priority (highest position); reorder afterward if it should match earlier. */
export function createRule(db: Database.Database, rule: NewRule): Rule {
  const projectId = rule.projectId ?? null
  const appPattern = rule.appPattern ?? null
  const titlePattern = rule.titlePattern ?? null
  const urlPattern = rule.urlPattern ?? null
  let id = 0
  let position = 0

  db.transaction(() => {
    const { maxPosition } = db.prepare('SELECT COALESCE(MAX(position), -1) AS maxPosition FROM rules').get() as {
      maxPosition: number
    }
    position = maxPosition + 1
    const result = db
      .prepare(
        `
        INSERT INTO rules (category_id, project_id, position, app_pattern, title_pattern, url_pattern)
        VALUES (@categoryId, @projectId, @position, @appPattern, @titlePattern, @urlPattern)
      `,
      )
      .run({ categoryId: rule.categoryId, projectId, position, appPattern, titlePattern, urlPattern })
    id = result.lastInsertRowid as number
    bumpDerivationVersion(db)
  })()

  return { id, categoryId: rule.categoryId, projectId, position, appPattern, titlePattern, urlPattern }
}

export function deleteRule(db: Database.Database, id: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM rules WHERE id = ?').run(id)
    bumpDerivationVersion(db)
  })()
}

/** Rewrites every Rule's `position` to match `orderedIds` (index = new priority, ascending). */
export function reorderRules(db: Database.Database, orderedIds: readonly number[]): void {
  db.transaction(() => {
    const update = db.prepare('UPDATE rules SET position = ? WHERE id = ?')
    orderedIds.forEach((id, index) => update.run(index, id))
    bumpDerivationVersion(db)
  })()
}
