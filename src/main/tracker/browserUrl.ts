/**
 * Browser identity and URL-source precedence (#22, ADR-0002).
 *
 * The Firefox WebExtension is the primary source for every browser it's
 * installed in, including Zen (Firefox-based). AppleScript is a fallback,
 * reachable only for the AppleScript-capable browsers. Neither is consulted
 * for non-browser apps.
 */

/** Bundle IDs this app recognizes as a browser at all (extension-reachable). */
export const BROWSER_BUNDLE_IDS: ReadonlySet<string> = new Set([
  'com.apple.Safari',
  'com.google.Chrome',
  'com.microsoft.edgemac',
  'com.brave.Browser',
  'company.thebrowser.Browser', // Arc
  'org.mozilla.firefox',
  'app.zen-browser.zen',
])

/** Bundle IDs that also support the AppleScript fallback when the extension isn't reporting. */
export const APPLESCRIPT_CAPABLE_BUNDLE_IDS: ReadonlySet<string> = new Set([
  'com.apple.Safari',
  'com.google.Chrome',
  'com.microsoft.edgemac',
  'com.brave.Browser',
  'company.thebrowser.Browser', // Arc
])

export type UrlSource = 'extension' | 'applescript' | 'none'

/**
 * Per-Heartbeat URL source precedence: Extension → AppleScript → none.
 * A non-browser app (or an unrecognized bundle id) never gets a URL. Zen has
 * no AppleScript fallback, so it degrades straight to 'none' when the
 * extension isn't reporting — the "app-level-only" degradation from #22.
 */
export function resolveUrlSource(bundleId: string | null, hasFreshExtensionUrl: boolean): UrlSource {
  if (!bundleId || !BROWSER_BUNDLE_IDS.has(bundleId)) return 'none'
  if (hasFreshExtensionUrl) return 'extension'
  if (APPLESCRIPT_CAPABLE_BUNDLE_IDS.has(bundleId)) return 'applescript'
  return 'none'
}
