import { describe, expect, it, vi } from 'vitest'
import { HeartbeatTracker } from './heartbeatTracker'
import type { Observation } from '../../shared/heartbeat'

function observation(overrides: Partial<Observation>): Observation {
  return {
    timestamp: 0,
    appName: 'Code',
    bundleId: 'com.microsoft.VSCode',
    windowTitle: null,
    url: null,
    idleSeconds: 0,
    ...overrides,
  }
}

describe('HeartbeatTracker', () => {
  it('does not persist anything before flush() is called', () => {
    const persist = vi.fn()
    const tracker = new HeartbeatTracker({ persist })

    tracker.handleObservation(observation({ timestamp: 0 }))
    tracker.handleObservation(observation({ timestamp: 3_000 }))

    expect(persist).not.toHaveBeenCalled()
  })

  it('debounces consecutive same-identity observations into one heartbeat', () => {
    const persist = vi.fn()
    const tracker = new HeartbeatTracker({ persist })

    tracker.handleObservation(observation({ timestamp: 0 }))
    tracker.handleObservation(observation({ timestamp: 3_000 }))
    tracker.handleObservation(observation({ timestamp: 6_000 }))
    tracker.flush()

    expect(persist).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledWith([
      expect.objectContaining({ startedAt: 0, endedAt: 6_000, appName: 'Code' }),
    ])
  })

  it('closes the prior heartbeat and starts a new one when the identity changes', () => {
    const persist = vi.fn()
    const tracker = new HeartbeatTracker({ persist })

    tracker.handleObservation(observation({ timestamp: 0, appName: 'Code' }))
    tracker.handleObservation(observation({ timestamp: 3_000, appName: 'Code' }))
    tracker.handleObservation(observation({ timestamp: 6_000, appName: 'Slack' }))
    tracker.flush()

    expect(persist).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledWith([
      expect.objectContaining({ startedAt: 0, endedAt: 3_000, appName: 'Code' }),
      expect.objectContaining({ startedAt: 6_000, endedAt: 6_000, appName: 'Slack' }),
    ])
  })

  it('batches every heartbeat completed since the last flush into a single persist call', () => {
    const persist = vi.fn()
    const tracker = new HeartbeatTracker({ persist })

    tracker.handleObservation(observation({ timestamp: 0, appName: 'Code' }))
    tracker.handleObservation(observation({ timestamp: 3_000, appName: 'Slack' }))
    tracker.handleObservation(observation({ timestamp: 6_000, appName: 'Mail' }))
    tracker.flush()

    expect(persist).toHaveBeenCalledTimes(1)
    expect(persist.mock.calls[0][0]).toHaveLength(3)
  })

  it('does not call persist on a flush with nothing pending', () => {
    const persist = vi.fn()
    const tracker = new HeartbeatTracker({ persist })

    tracker.flush()

    expect(persist).not.toHaveBeenCalled()
  })

  it('never mutates a heartbeat already handed to persist (append-only)', () => {
    const persisted: unknown[][] = []
    const tracker = new HeartbeatTracker({ persist: (heartbeats) => persisted.push([...heartbeats]) })

    tracker.handleObservation(observation({ timestamp: 0 }))
    tracker.flush()
    const firstBatchSnapshot = JSON.stringify(persisted[0])

    tracker.handleObservation(observation({ timestamp: 10_000 }))
    tracker.flush()

    expect(JSON.stringify(persisted[0])).toBe(firstBatchSnapshot)
  })

  it('closes the open heartbeat on system suspend without starting a new one', () => {
    const persist = vi.fn()
    const tracker = new HeartbeatTracker({ persist })

    tracker.handleObservation(observation({ timestamp: 0 }))
    tracker.handleObservation(observation({ timestamp: 3_000 }))
    tracker.handleSystemSuspend()
    tracker.flush()

    expect(persist).toHaveBeenCalledWith([expect.objectContaining({ startedAt: 0, endedAt: 3_000 })])
  })

  it('records the most recent idleSeconds observed for a still-open heartbeat', () => {
    const persist = vi.fn()
    const tracker = new HeartbeatTracker({ persist })

    tracker.handleObservation(observation({ timestamp: 0, idleSeconds: 0 }))
    tracker.handleObservation(observation({ timestamp: 3_000, idleSeconds: 3 }))
    tracker.flush()

    expect(persist).toHaveBeenCalledWith([expect.objectContaining({ idleSeconds: 3 })])
  })

  it('lets a flush-split session be re-merged into one span by derive()', async () => {
    const persisted: import('../../shared/heartbeat').Heartbeat[] = []
    const tracker = new HeartbeatTracker({ persist: (heartbeats) => persisted.push(...heartbeats) })

    tracker.handleObservation(observation({ timestamp: 0 }))
    tracker.handleObservation(observation({ timestamp: 3_000 }))
    tracker.flush() // periodic flush splits the still-open session
    tracker.handleObservation(observation({ timestamp: 6_000 }))
    tracker.handleObservation(observation({ timestamp: 9_000 }))
    tracker.flush()

    expect(persisted).toHaveLength(2)

    const { derive } = await import('../../shared/derive')
    const { spans } = derive({ heartbeats: persisted, now: 9_000 })
    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 9_000 })])
  })
})
