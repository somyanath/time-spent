import type { Migration } from '../migrations'

/**
 * The ordered list of schema migrations.
 *
 * Intentionally empty for the walking skeleton (issue #16): the schema starts
 * empty and tables arrive with the slices that need them. Append a new entry
 * (version = previous + 1) here when a slice introduces a table.
 *
 * Heartbeats stay append-only and carry no derived columns (ADR-0001).
 */
export const migrations: Migration[] = []
