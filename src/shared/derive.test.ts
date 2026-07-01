import { describe, expect, it } from 'vitest'
import { derive } from './derive'
import type { Heartbeat } from './heartbeat'

function heartbeat(overrides: Partial<Heartbeat>): Heartbeat {
  return {
    startedAt: 0,
    endedAt: 1_000,
    appName: 'Code',
    bundleId: 'com.microsoft.VSCode',
    windowTitle: null,
    url: null,
    idleSeconds: 0,
    ...overrides,
  }
}

describe('derive', () => {
  it('returns no spans for no heartbeats', () => {
    const result = derive({ heartbeats: [], now: 0 })

    expect(result.spans).toEqual([])
  })

  it('merges consecutive like-heartbeats into a single span', () => {
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
      heartbeat({ startedAt: 3_000, endedAt: 6_000 }),
      heartbeat({ startedAt: 6_000, endedAt: 9_000 }),
    ]

    const { spans } = derive({ heartbeats, now: 9_000 })

    expect(spans).toEqual([
      expect.objectContaining({ startedAt: 0, endedAt: 9_000, appName: 'Code' }),
    ])
  })

  it('bridges a small gap left by a periodic tracker flush (within the merge tolerance)', () => {
    // A flush closes the open heartbeat a little before the next poll opens
    // a fresh one for the same still-active app — this is expected, not a
    // real interruption, so derive() should still merge them into one span.
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
      heartbeat({ startedAt: 3_500, endedAt: 6_500 }),
    ]

    const { spans } = derive({ heartbeats, now: 6_500 })

    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 6_500 })])
  })

  it('does not merge across a gap larger than the configured tolerance', () => {
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
      heartbeat({ startedAt: 20_000, endedAt: 23_000 }),
    ]

    const { spans } = derive({ heartbeats, now: 23_000, config: { mergeGapToleranceMs: 3_000 } })

    expect(spans).toHaveLength(2)
    expect(spans[0]).toEqual(expect.objectContaining({ startedAt: 0, endedAt: 3_000 }))
    expect(spans[1]).toEqual(expect.objectContaining({ startedAt: 20_000, endedAt: 23_000 }))
  })

  it('does not merge heartbeats from different apps even when contiguous', () => {
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000, appName: 'Code' }),
      heartbeat({ startedAt: 3_000, endedAt: 6_000, appName: 'Slack' }),
    ]

    const { spans } = derive({ heartbeats, now: 6_000 })

    expect(spans).toHaveLength(2)
    expect(spans.map((s) => s.appName)).toEqual(['Code', 'Slack'])
  })

  it('does not merge heartbeats with a different window title or url', () => {
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000, windowTitle: 'PR #17' }),
      heartbeat({ startedAt: 3_000, endedAt: 6_000, windowTitle: 'PR #18' }),
    ]

    const { spans } = derive({ heartbeats, now: 6_000 })

    expect(spans).toHaveLength(2)
  })

  it('sorts out-of-order heartbeats before merging', () => {
    const heartbeats = [
      heartbeat({ startedAt: 3_000, endedAt: 6_000 }),
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
    ]

    const { spans } = derive({ heartbeats, now: 6_000 })

    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 6_000 })])
  })

  it('excludes heartbeats that start after the injected clock', () => {
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
      heartbeat({ startedAt: 100_000, endedAt: 103_000 }),
    ]

    const { spans } = derive({ heartbeats, now: 3_000 })

    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 3_000 })])
  })
})
