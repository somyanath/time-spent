import type { Category, ProductivityRating, Rule } from './category'
import type { DiscardedSpan } from './discardedSpan'
import type { Span } from './heartbeat'
import type { ManualEntry } from './manualEntry'
import type { Override } from './override'
import type { AppSettings, PermissionsStatus } from './permissions'
import type { Project } from './project'
import type { WorkingHoursSchedule, WorkModeState } from './workMode'

/**
 * The typed surface the preload bridge exposes to the renderer on
 * `window.timeTracker`. Kept in `shared/` so both the preload (which implements
 * it) and the renderer (which consumes it) depend on one definition.
 */
export interface TimeTrackerApi {
  versions: {
    electron: string
    chrome: string
    node: string
  }
  /** Today's derived Spans, via the daily rollup cache. */
  getTodaySpans: () => Promise<Span[]>

  listCategories: () => Promise<Category[]>
  createCategory: (name: string, rating: ProductivityRating) => Promise<Category>
  updateCategory: (id: number, updates: { name?: string; rating?: ProductivityRating }) => Promise<void>
  deleteCategory: (id: number) => Promise<void>

  listProjects: () => Promise<Project[]>
  createProject: (name: string, client?: string | null) => Promise<Project>
  updateProject: (id: number, updates: { name?: string; client?: string | null }) => Promise<void>
  deleteProject: (id: number) => Promise<void>

  listRules: () => Promise<Rule[]>
  createRule: (rule: {
    categoryId: number
    projectId?: number | null
    appPattern?: string | null
    titlePattern?: string | null
    urlPattern?: string | null
  }) => Promise<Rule>
  deleteRule: (id: number) => Promise<void>
  reorderRules: (orderedIds: number[]) => Promise<void>

  /** Asserts a Category/Project for the given time range, winning over Rules and surviving later Rule edits. */
  createOverride: (override: {
    startedAt: number
    endedAt: number
    categoryId: number
    projectId?: number | null
  }) => Promise<Override>
  /** Reverts the time range to whatever the Rules layer computes for it. */
  deleteOverride: (id: number) => Promise<void>

  /** Adds a stored Span for time the tracker couldn't observe. */
  createManualEntry: (entry: {
    startedAt: number
    endedAt: number
    label: string
    categoryId: number
    projectId?: number | null
  }) => Promise<ManualEntry>
  deleteManualEntry: (id: number) => Promise<void>

  /** Excludes the given time range from all metrics without touching the underlying Heartbeats. */
  createDiscardedSpan: (span: { startedAt: number; endedAt: number }) => Promise<DiscardedSpan>

  getSettings: () => Promise<AppSettings>
  /** Toggling on stops requesting Screen Recording and titles going forward; toggling off re-requests the grant. */
  setAppLevelOnly: (value: boolean) => Promise<AppSettings>

  /** The effective Work Mode right now: the Working Hours schedule plus any still-active manual override (#24). */
  getWorkModeState: () => Promise<WorkModeState>
  getWorkingHours: () => Promise<WorkingHoursSchedule>
  /** Replaces the whole per-weekday schedule in one write. */
  setWorkingHours: (schedule: WorkingHoursSchedule) => Promise<WorkingHoursSchedule>
  /** Forces Work Mode to `value` until the next scheduled boundary, after which the schedule resumes on its own. */
  setWorkModeOverride: (value: boolean) => Promise<WorkModeState>
  clearWorkModeOverride: () => Promise<WorkModeState>

  /** Screen Recording grant status, plus whether recent Heartbeats show it's silently lapsed (#21). */
  getPermissionsStatus: () => Promise<PermissionsStatus>
  requestScreenRecordingAccess: () => Promise<void>
  openScreenRecordingSettings: () => Promise<void>
}
