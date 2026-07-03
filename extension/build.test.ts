import { describe, expect, it } from 'vitest'
import { buildManifest } from './build.mjs'

describe('buildManifest', () => {
  it('produces a Chromium manifest with a service-worker background', () => {
    const manifest = buildManifest('chrome')
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.background).toEqual({ service_worker: 'background.js' })
    expect(manifest.browser_specific_settings).toBeUndefined()
  })

  it('produces a Firefox manifest with an event-page background', () => {
    const manifest = buildManifest('firefox')
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.background).toEqual({ scripts: ['background.js'] })
    expect(manifest.browser_specific_settings?.gecko?.id).toBe('url-capture@time-tracker.local')
  })

  it('scopes both targets to localhost only, with no other host permissions', () => {
    for (const target of ['chrome', 'firefox'] as const) {
      expect(buildManifest(target).host_permissions).toEqual(['http://127.0.0.1/*'])
    }
  })

  it('keeps the options page wired identically on both targets', () => {
    for (const target of ['chrome', 'firefox'] as const) {
      expect(buildManifest(target).options_ui).toEqual({ page: 'options.html', open_in_tab: false })
    }
  })
})
