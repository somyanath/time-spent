/**
 * A Category's three-way classification (CONTEXT.md). Focus counts toward
 * Focus Sessions; Distracting is the only thing that triggers the Nudge and
 * drags down distraction/quality metrics; Neutral is real work that is never
 * punished.
 */
export type ProductivityRating = 'focus' | 'neutral' | 'distracting'

/** A label for what kind of activity a heartbeat represents, orthogonal to Project. */
export interface Category {
  id: number
  name: string
  rating: ProductivityRating
}

/**
 * An ordered, user-defined mapping from observed span facts (app / title /
 * url pattern) to a Category and, independently, a Project (#19) — the same
 * pattern match can assign either, both, so a Span carries both dimensions
 * from one winning Rule. Applied at read time in `derive()` — the
 * lowest-priority source of categorization (ADR-0001); a stored Override
 * (#20) wins over any Rule. Lower `position` is matched first.
 *
 * At least one pattern field is expected to be non-null; a rule with every
 * pattern null would match every span.
 */
export interface Rule {
  id: number
  categoryId: number
  projectId: number | null
  position: number
  appPattern: string | null
  titlePattern: string | null
  urlPattern: string | null
}

/** The sensible default a Span resolves to when no Rule matches it. */
export const UNCATEGORIZED = {
  categoryId: null as number | null,
  categoryName: 'Uncategorized',
  rating: 'neutral' as ProductivityRating,
}
