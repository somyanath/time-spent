import { UNCATEGORIZED } from './category'
import type { Category, Rule } from './category'
import type { Heartbeat, Span } from './heartbeat'
import type { Project } from './project'

/**
 * Tunable thresholds `derive()` reads. Later slices add focus-window,
 * idle, Nudge, and Break-Reminder thresholds here; this slice only needs
 * the Span merge-gap tolerance.
 */
export interface DeriveConfig {
  /**
   * How large a gap between two same-identity heartbeats is still treated
   * as one continuous Span, rather than an interruption. Bridges the small
   * gap a periodic tracker flush leaves before the next poll reopens a
   * heartbeat for the still-active app. Defaults to one poll interval.
   */
  mergeGapToleranceMs?: number
}

/**
 * The pure derivation core (seam ①). Reads stored Heartbeats plus
 * categorization/config inputs and an injected clock, and derives the
 * entire model. Spans are categorized and, orthogonally, attributed to a
 * Project via the ordered Rules layer (#18, #19); `overrides` and
 * `manualEntries` are still unused — the signature is the contract later
 * slices (#20-#27) grow into.
 */
export interface DeriveInput {
  heartbeats: readonly Heartbeat[]
  categories?: readonly Category[]
  projects?: readonly Project[]
  rules?: readonly Rule[]
  overrides?: readonly unknown[]
  manualEntries?: readonly unknown[]
  config?: DeriveConfig
  now: number
}

export interface DeriveResult {
  spans: Span[]
}

const DEFAULT_MERGE_GAP_TOLERANCE_MS = 3_000

export function derive(input: DeriveInput): DeriveResult {
  const mergeGapToleranceMs = input.config?.mergeGapToleranceMs ?? DEFAULT_MERGE_GAP_TOLERANCE_MS
  const orderedRules = [...(input.rules ?? [])].sort((a, b) => a.position - b.position)
  const categoriesById = new Map((input.categories ?? []).map((category) => [category.id, category]))
  const projectsById = new Map((input.projects ?? []).map((project) => [project.id, project]))

  const sorted = input.heartbeats
    .filter((heartbeat) => heartbeat.startedAt <= input.now)
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt)

  const spans: Span[] = []
  for (const heartbeat of sorted) {
    const last = spans[spans.length - 1]
    if (last && sameIdentity(last, heartbeat) && heartbeat.startedAt - last.endedAt <= mergeGapToleranceMs) {
      last.endedAt = Math.max(last.endedAt, heartbeat.endedAt)
      continue
    }
    spans.push({
      startedAt: heartbeat.startedAt,
      endedAt: heartbeat.endedAt,
      appName: heartbeat.appName,
      bundleId: heartbeat.bundleId,
      windowTitle: heartbeat.windowTitle,
      url: heartbeat.url,
      ...categorize(heartbeat, orderedRules, categoriesById, projectsById),
    })
  }

  return { spans }
}

function sameIdentity(span: Span, heartbeat: Heartbeat): boolean {
  return (
    span.appName === heartbeat.appName &&
    span.bundleId === heartbeat.bundleId &&
    span.windowTitle === heartbeat.windowTitle &&
    span.url === heartbeat.url
  )
}

const UNPROJECTED = { projectId: null as number | null, projectName: null as string | null }

/**
 * Categorizes a span by its observed facts against the ordered Rules layer
 * (ADR-0001's lowest-priority, fully recomputable categorization), and
 * orthogonally attributes it to a Project (#19) via the same winning Rule.
 * The first rule (by ascending `position`) whose every non-null pattern
 * matches wins for both dimensions; unmatched spans get the Uncategorized
 * default and a null Project.
 */
function categorize(
  facts: Pick<Heartbeat, 'appName' | 'windowTitle' | 'url'>,
  orderedRules: readonly Rule[],
  categoriesById: Map<number, Category>,
  projectsById: Map<number, Project>,
): Pick<Span, 'categoryId' | 'categoryName' | 'rating' | 'projectId' | 'projectName'> {
  for (const rule of orderedRules) {
    if (!ruleMatches(rule, facts)) continue
    const category = categoriesById.get(rule.categoryId)
    if (!category) continue
    const project = rule.projectId !== null ? projectsById.get(rule.projectId) : undefined
    return {
      categoryId: category.id,
      categoryName: category.name,
      rating: category.rating,
      ...(project ? { projectId: project.id, projectName: project.name } : UNPROJECTED),
    }
  }
  return { ...UNCATEGORIZED, ...UNPROJECTED }
}

function ruleMatches(rule: Rule, facts: Pick<Heartbeat, 'appName' | 'windowTitle' | 'url'>): boolean {
  return (
    matchesPattern(rule.appPattern, facts.appName) &&
    matchesPattern(rule.titlePattern, facts.windowTitle) &&
    matchesPattern(rule.urlPattern, facts.url)
  )
}

/** A null pattern is not required to match; a non-null pattern requires a case-insensitive substring match. */
function matchesPattern(pattern: string | null, value: string | null): boolean {
  if (pattern === null) return true
  if (value === null) return false
  return value.toLowerCase().includes(pattern.toLowerCase())
}
