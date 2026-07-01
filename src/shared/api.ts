import type { Category, ProductivityRating, Rule } from './category'
import type { Span } from './heartbeat'

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

  listRules: () => Promise<Rule[]>
  createRule: (rule: {
    categoryId: number
    appPattern?: string | null
    titlePattern?: string | null
    urlPattern?: string | null
  }) => Promise<Rule>
  deleteRule: (id: number) => Promise<void>
  reorderRules: (orderedIds: number[]) => Promise<void>
}
