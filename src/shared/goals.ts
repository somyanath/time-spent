/** Daily Goals (#27), as stored in Settings: user-set, no default — null disables that goal entirely. */
export interface GoalsConfig {
  focusTargetMs: number | null
  overworkCeilingMs: number | null
}
