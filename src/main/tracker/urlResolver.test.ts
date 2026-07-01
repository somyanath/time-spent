import { describe, expect, it, vi } from 'vitest'
import { createUrlResolver } from './urlResolver'

describe('createUrlResolver', () => {
  it('returns the extension URL when the extension has a fresh one', async () => {
    const getAppleScriptUrl = vi.fn()
    const resolveUrl = createUrlResolver({
      getExtensionUrl: () => 'https://example.com/from-extension',
      getAppleScriptUrl,
    })

    const url = await resolveUrl('com.apple.Safari')

    expect(url).toBe('https://example.com/from-extension')
    expect(getAppleScriptUrl).not.toHaveBeenCalled()
  })

  it('falls back to AppleScript when the extension has nothing fresh', async () => {
    const getAppleScriptUrl = vi.fn().mockResolvedValue('https://example.com/from-applescript')
    const resolveUrl = createUrlResolver({
      getExtensionUrl: () => null,
      getAppleScriptUrl,
    })

    const url = await resolveUrl('com.apple.Safari')

    expect(url).toBe('https://example.com/from-applescript')
    expect(getAppleScriptUrl).toHaveBeenCalledWith('com.apple.Safari')
  })

  it('resolves to null for Zen when the extension has nothing fresh (no AppleScript fallback)', async () => {
    const getAppleScriptUrl = vi.fn()
    const resolveUrl = createUrlResolver({
      getExtensionUrl: () => null,
      getAppleScriptUrl,
    })

    const url = await resolveUrl('app.zen-browser.zen')

    expect(url).toBeNull()
    expect(getAppleScriptUrl).not.toHaveBeenCalled()
  })

  it('resolves to null for a non-browser app regardless of extension state', async () => {
    const resolveUrl = createUrlResolver({ getExtensionUrl: () => 'https://example.com/stale' })

    const url = await resolveUrl('com.apple.Terminal')

    expect(url).toBeNull()
  })

  it('resolves to null when there is no bundle id', async () => {
    const resolveUrl = createUrlResolver({ getExtensionUrl: () => 'https://example.com/stale' })

    const url = await resolveUrl(null)

    expect(url).toBeNull()
  })
})
