import { UNCATEGORIZED } from './category'
import type { Category, ProductivityRating, Rule } from './category'
import type { DiscardedSpan } from './discardedSpan'
import type { Heartbeat, Span } from './heartbeat'
import type { ManualEntry } from './manualEntry'
import type { Override } from './override'
import type { Project } from './project'

/**
 * Tunable thresholds `derive()` reads. Later slices add Nudge and
 * Break-Reminder thresholds here.
 */
export interface DeriveConfig {
  /**
   * How large a gap between two same-identity heartbeats is still treated
   * as one continuous Span, rather than an interruption. Bridges the small
   * gap a periodic tracker flush leaves before the next poll reopens a
   * heartbeat for the still-active app. Defaults to one poll interval.
   */
  mergeGapToleranceMs?: number
  /** How long with no HID input before idle becomes a gap. Defaults to 5 min. */
  idleThresholdMs?: number
  /** The longest an idle gap can be and still become a Break; longer gaps (or sleep/lock) are discarded. Defaults to 60 min. */
  breakMaxMs?: number
  /** The rolling window a Focus Session's purity is measured over. Defaults to 15 min. */
  focusWindowMs?: number
  /** The share of a Focus Session window that must be Focus-rated. Defaults to 0.75. */
  focusPurityThreshold?: number
  /** Category ids where lack of HID input does not imply absence (e.g. Video Conferencing), so idle is never carved into a gap. */
  presenceWithoutInputCategoryIds?: readonly number[]
}

/**
 * The pure derivation core (seam ①). Reads stored Heartbeats plus
 * categorization/config inputs and an injected clock, and derives the
 * entire model. Spans are categorized and, orthogonally, attributed to a
 * Project via the ordered Rules layer (#18, #19), then the editable-timeline
 * layering (#20) applies on top: stored Overrides win over Rules, Manual
 * Entries are merged in as additional Spans, and Discards exclude a Span
 * from the result entirely.
 */
export interface DeriveInput {
  heartbeats: readonly Heartbeat[]
  categories?: readonly Category[]
  projects?: readonly Project[]
  rules?: readonly Rule[]
  overrides?: readonly Override[]
  manualEntries?: readonly ManualEntry[]
  discardedSpans?: readonly DiscardedSpan[]
  config?: DeriveConfig
  now: number
}

/** A derived span where the user stepped away for roughly 5–60 min (machine awake). */
export interface Break {
  startedAt: number
  endedAt: number
}

/** A derived span where at least the purity threshold of a rolling window was spent on Focus-rated activity. */
export interface FocusSession {
  startedAt: number
  endedAt: number
}

export interface DeriveResult {
  spans: Span[]
  breaks: Break[]
  focusSessions: FocusSession[]
}

const DEFAULT_MERGE_GAP_TOLERANCE_MS = 3_000
const DEFAULT_IDLE_THRESHOLD_MS = 5 * 60_000
const DEFAULT_BREAK_MAX_MS = 60 * 60_000
const DEFAULT_FOCUS_WINDOW_MS = 15 * 60_000
const DEFAULT_FOCUS_PURITY_THRESHOLD = 0.75

export function derive(input: DeriveInput): DeriveResult {
  const mergeGapToleranceMs = input.config?.mergeGapToleranceMs ?? DEFAULT_MERGE_GAP_TOLERANCE_MS
  const idleThresholdMs = input.config?.idleThresholdMs ?? DEFAULT_IDLE_THRESHOLD_MS
  const breakMaxMs = input.config?.breakMaxMs ?? DEFAULT_BREAK_MAX_MS
  const focusWindowMs = input.config?.focusWindowMs ?? DEFAULT_FOCUS_WINDOW_MS
  const focusPurityThreshold = input.config?.focusPurityThreshold ?? DEFAULT_FOCUS_PURITY_THRESHOLD
  const presenceWithoutInputCategoryIds = new Set(input.config?.presenceWithoutInputCategoryIds ?? [])
  const orderedRules = [...(input.rules ?? [])].sort((a, b) => a.position - b.position)
  const categoriesById = new Map((input.categories ?? []).map((category) => [category.id, category]))
  const projectsById = new Map((input.projects ?? []).map((project) => [project.id, project]))

  const sorted = input.heartbeats
    .filter((heartbeat) => heartbeat.startedAt <= input.now)
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt)

  interface MergedSpan {
    span: Span
    idleSeconds: number
  }

  const merged: MergedSpan[] = []
  for (const heartbeat of sorted) {
    const last = merged[merged.length - 1]
    if (last && sameIdentity(last.span, heartbeat) && heartbeat.startedAt - last.span.endedAt <= mergeGapToleranceMs) {
      last.span.endedAt = Math.max(last.span.endedAt, heartbeat.endedAt)
      last.idleSeconds = heartbeat.idleSeconds
      continue
    }
    merged.push({
      idleSeconds: heartbeat.idleSeconds,
      span: {
        startedAt: heartbeat.startedAt,
        endedAt: heartbeat.endedAt,
        appName: heartbeat.appName,
        bundleId: heartbeat.bundleId,
        windowTitle: heartbeat.windowTitle,
        url: heartbeat.url,
        overrideId: null,
        manualEntryId: null,
        ...categorize(heartbeat, orderedRules, categoriesById, projectsById),
      },
    })
  }

  const { activeSpans, breaks } = carveIdleGaps(merged, {
    idleThresholdMs,
    breakMaxMs,
    presenceWithoutInputCategoryIds,
  })

  const overridden = applyOverrides(activeSpans, input.overrides ?? [], categoriesById, projectsById)
  const withManualEntries = [
    ...overridden,
    ...manualEntriesToSpans(input.manualEntries ?? [], categoriesById, projectsById),
  ].sort((a, b) => a.startedAt - b.startedAt)

  const spans = excludeDiscarded(withManualEntries, input.discardedSpans ?? [])
  const focusSessions = computeFocusSessions(spans, focusWindowMs, focusPurityThreshold)

  return { spans, breaks, focusSessions }
}

/**
 * Idle (`idle_seconds`, already observed per Heartbeat) becomes a gap once a
 * merged run's trailing idle time crosses the threshold — unless its
 * Category is Presence-without-input, where lack of HID input doesn't imply
 * absence. A gap of 5–60 min becomes a Break; longer gaps are discarded
 * entirely (counted as nothing), same as a raw discontinuity between two
 * Heartbeats (sleep/lock, since the tracker closes the open Heartbeat on
 * suspend and only resumes on wake) — no Break is ever synthesized for time
 * with no Heartbeat coverage at all, regardless of how long that gap is.
 */
function carveIdleGaps(
  merged: readonly { span: Span; idleSeconds: number }[],
  options: { idleThresholdMs: number; breakMaxMs: number; presenceWithoutInputCategoryIds: ReadonlySet<number> },
): { activeSpans: Span[]; breaks: Break[] } {
  const activeSpans: Span[] = []
  const breaks: Break[] = []

  for (const { span, idleSeconds } of merged) {
    const idleMs = idleSeconds * 1_000
    const suppressed = span.categoryId !== null && options.presenceWithoutInputCategoryIds.has(span.categoryId)
    if (idleMs < options.idleThresholdMs || suppressed) {
      activeSpans.push(span)
      continue
    }

    const idleStart = Math.max(span.startedAt, span.endedAt - idleMs)
    if (idleStart > span.startedAt) {
      activeSpans.push({ ...span, endedAt: idleStart })
    }

    const idleDurationMs = span.endedAt - idleStart
    if (idleDurationMs <= options.breakMaxMs) {
      breaks.push({ startedAt: idleStart, endedAt: span.endedAt })
    }
  }

  return { activeSpans, breaks }
}

/**
 * A Focus Session forms over a maximal run of active Spans whose trailing
 * rolling window (default 15 min) is at least the purity threshold (default
 * 75%) Focus-rated. The window's denominator is the fixed window length, not
 * just observed active time, so an idle/Break gap inside the window counts
 * against purity the same as any other non-Focus time — and frequent
 * switching among Focus-rated Spans never resets the run, since only rating
 * (not app identity) affects the ratio.
 */
function computeFocusSessions(spans: readonly Span[], windowMs: number, purityThreshold: number): FocusSession[] {
  const intervals = spans
    .map((span) => ({ startedAt: span.startedAt, endedAt: span.endedAt, rating: span.rating }))
    .sort((a, b) => a.startedAt - b.startedAt)

  const sessions: FocusSession[] = []
  let sessionStart: number | null = null
  let sessionEnd: number | null = null

  for (const interval of intervals) {
    const windowStart = interval.endedAt - windowMs
    const focusMs = sumRatedOverlap(intervals, 'focus', windowStart, interval.endedAt)
    const eligible = focusMs / windowMs >= purityThreshold

    if (eligible) {
      if (sessionStart === null) sessionStart = interval.startedAt
      sessionEnd = interval.endedAt
    } else if (sessionStart !== null) {
      sessions.push({ startedAt: sessionStart, endedAt: sessionEnd! })
      sessionStart = null
      sessionEnd = null
    }
  }
  if (sessionStart !== null) sessions.push({ startedAt: sessionStart, endedAt: sessionEnd! })

  return sessions
}

function sumRatedOverlap(
  intervals: readonly { startedAt: number; endedAt: number; rating: ProductivityRating }[],
  rating: ProductivityRating,
  windowStart: number,
  windowEnd: number,
): number {
  let total = 0
  for (const interval of intervals) {
    if (interval.rating !== rating) continue
    const overlapStart = Math.max(interval.startedAt, windowStart)
    const overlapEnd = Math.min(interval.endedAt, windowEnd)
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart
  }
  return total
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Overrides are sticky and always win over Rules (ADR-0001): applied after
 * Rule-based categorization, matched to a derived Span by time-range
 * overlap so an Override keeps winning across later Rule edits.
 */
function applyOverrides(
  spans: readonly Span[],
  overrides: readonly Override[],
  categoriesById: Map<number, Category>,
  projectsById: Map<number, Project>,
): Span[] {
  if (overrides.length === 0) return spans.slice()

  return spans.map((span) => {
    const matched = overrides.find((candidate) => overlaps(candidate.startedAt, candidate.endedAt, span.startedAt, span.endedAt))
    if (!matched) return span
    const category = categoriesById.get(matched.categoryId)
    if (!category) return span
    const project = matched.projectId !== null ? projectsById.get(matched.projectId) : undefined
    return {
      ...span,
      overrideId: matched.id,
      categoryId: category.id,
      categoryName: category.name,
      rating: category.rating,
      ...(project ? { projectId: project.id, projectName: project.name } : UNPROJECTED),
    }
  })
}

/**
 * Manual Entries are stored, user-authored Spans for time the tracker
 * couldn't observe — merged in at read time alongside the Heartbeat-derived
 * Spans, categorized the same way a winning Rule would be.
 */
function manualEntriesToSpans(
  manualEntries: readonly ManualEntry[],
  categoriesById: Map<number, Category>,
  projectsById: Map<number, Project>,
): Span[] {
  return manualEntries.map((entry) => {
    const category = categoriesById.get(entry.categoryId)
    const project = entry.projectId !== null ? projectsById.get(entry.projectId) : undefined
    return {
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      appName: entry.label,
      bundleId: null,
      windowTitle: null,
      url: null,
      overrideId: null,
      manualEntryId: entry.id,
      categoryId: category?.id ?? UNCATEGORIZED.categoryId,
      categoryName: category?.name ?? UNCATEGORIZED.categoryName,
      rating: category?.rating ?? UNCATEGORIZED.rating,
      ...(project ? { projectId: project.id, projectName: project.name } : UNPROJECTED),
    }
  })
}

/** Discard excludes a Span from the result entirely, without touching the underlying Heartbeats — matched by time-range overlap. */
function excludeDiscarded(spans: readonly Span[], discardedSpans: readonly DiscardedSpan[]): Span[] {
  if (discardedSpans.length === 0) return spans.slice()
  return spans.filter(
    (span) => !discardedSpans.some((discarded) => overlaps(discarded.startedAt, discarded.endedAt, span.startedAt, span.endedAt)),
  )
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
