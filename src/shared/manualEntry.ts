/**
 * A stored, user-authored Span for time the tracker couldn't observe
 * (offline meetings, calls, a paper notebook). Merged into `derive()`'s
 * output at read time alongside the Heartbeat-derived Spans, so it appears
 * on the timeline and counts toward metrics like any other Span.
 */
export interface ManualEntry {
  id: number
  startedAt: number
  endedAt: number
  label: string
  categoryId: number
  projectId: number | null
}
