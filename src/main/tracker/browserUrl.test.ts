import { describe, expect, it } from 'vitest'
import { resolveUrlSource } from './browserUrl'

describe('resolveUrlSource', () => {
  it('prefers the extension when it has a fresh URL', () => {
    expect(resolveUrlSource('com.apple.Safari', true)).toBe('extension')
  })

  it('falls back to AppleScript for an AppleScript-capable browser with no fresh extension URL', () => {
    expect(resolveUrlSource('com.apple.Safari', false)).toBe('applescript')
    expect(resolveUrlSource('com.google.Chrome', false)).toBe('applescript')
  })

  it('degrades Zen straight to none when the extension is not reporting (no AppleScript fallback)', () => {
    expect(resolveUrlSource('app.zen-browser.zen', false)).toBe('none')
  })

  it('prefers the extension for Zen when it does have a fresh URL', () => {
    expect(resolveUrlSource('app.zen-browser.zen', true)).toBe('extension')
  })

  it('never resolves a URL for a non-browser app', () => {
    expect(resolveUrlSource('com.apple.Terminal', true)).toBe('none')
  })

  it('never resolves a URL when there is no bundle id', () => {
    expect(resolveUrlSource(null, true)).toBe('none')
  })
})
