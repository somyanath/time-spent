import { describe, expect, it } from 'vitest'
import { detectSilentPermissionLapse } from './permissions'

function heartbeat(windowTitle: string | null): { windowTitle: string | null } {
  return { windowTitle }
}

describe('detectSilentPermissionLapse', () => {
  it('reports no lapse in App-level-only mode, regardless of titles', () => {
    const heartbeats = Array.from({ length: 10 }, () => heartbeat(null))

    expect(detectSilentPermissionLapse(heartbeats, { appLevelOnly: true })).toBe(false)
  })

  it('reports no lapse when there are too few Heartbeats to judge yet', () => {
    const heartbeats = [heartbeat(null), heartbeat(null)]

    expect(detectSilentPermissionLapse(heartbeats, { appLevelOnly: false, minSampleSize: 5 })).toBe(false)
  })

  it('reports no lapse when at least one recent Heartbeat carries a title', () => {
    const heartbeats = [heartbeat(null), heartbeat(null), heartbeat('Inbox — Gmail'), heartbeat(null), heartbeat(null)]

    expect(detectSilentPermissionLapse(heartbeats, { appLevelOnly: false, minSampleSize: 5 })).toBe(false)
  })

  it('reports a lapse when every recent Heartbeat has a null title and the grant should be active', () => {
    const heartbeats = Array.from({ length: 5 }, () => heartbeat(null))

    expect(detectSilentPermissionLapse(heartbeats, { appLevelOnly: false, minSampleSize: 5 })).toBe(true)
  })

  it('defaults the minimum sample size to 5', () => {
    const fourNulls = Array.from({ length: 4 }, () => heartbeat(null))
    const fiveNulls = Array.from({ length: 5 }, () => heartbeat(null))

    expect(detectSilentPermissionLapse(fourNulls, { appLevelOnly: false })).toBe(false)
    expect(detectSilentPermissionLapse(fiveNulls, { appLevelOnly: false })).toBe(true)
  })
})
