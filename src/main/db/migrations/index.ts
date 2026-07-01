import type { Migration } from './types'

/**
 * The ordered list of schema migrations the app applies on startup.
 *
 * Slice 1 (the walking skeleton) ships an intentionally empty schema: per
 * ADR-0001 the only durable truth is the append-only `heartbeats` stream, and
 * tables arrive with the slices that first need them (heartbeats persistence,
 * the derived-on-read rollup cache, etc.). Add migrations here — never edit an
 * already-released one — with strictly increasing, unique `version` numbers.
 */
export const migrations: Migration[] = []

export { runMigrations } from './runner'
export type { Migration, MigrationResult } from './types'
