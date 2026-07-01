import { createHeartbeats } from './001-create-heartbeats'
import { createDailyRollup } from './002-create-daily-rollup'
import { createCategories } from './003-create-categories'
import { createRules } from './004-create-rules'
import { addDerivationVersion } from './005-add-derivation-version'
import type { Migration } from './types'

/**
 * The ordered list of schema migrations the app applies on startup.
 *
 * Per ADR-0001 the only durable truth is the append-only `heartbeats` stream;
 * everything else (the daily rollup cache, categories, rules, ...) is a cache
 * or a later slice's addition. Add migrations here — never edit an
 * already-released one — with strictly increasing, unique `version` numbers.
 */
export const migrations: Migration[] = [
  createHeartbeats,
  createDailyRollup,
  createCategories,
  createRules,
  addDerivationVersion,
]

export { runMigrations } from './runner'
export type { Migration, MigrationResult } from './types'
