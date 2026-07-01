/**
 * A stored assertion that a specific time range should carry the given
 * Category and, optionally, Project — regardless of what the ordered Rules
 * layer (`derive()`) would compute for it. Per ADR-0001, the Override is the
 * only categorization that is persisted rather than derived: sticky (it
 * survives later Rule edits) and highest priority (it always wins over
 * Rules). Matched against a derived Span by time-range overlap.
 */
export interface Override {
  id: number
  startedAt: number
  endedAt: number
  categoryId: number
  projectId: number | null
}
