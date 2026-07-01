/**
 * The typed surface the preload bridge exposes to the renderer on
 * `window.timeTracker`. Kept in `shared/` so both the preload (which implements
 * it) and the renderer (which consumes it) depend on one definition.
 *
 * Slice 1 exposes only runtime versions — enough to prove the
 * main → preload → renderer bridge is wired end to end. Real IPC channels
 * (heartbeats, derived state) arrive with later slices.
 */
export interface TimeTrackerApi {
  versions: {
    electron: string
    chrome: string
    node: string
  }
}
