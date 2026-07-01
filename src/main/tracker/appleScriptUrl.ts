import { execFile } from 'node:child_process'
import { APPLESCRIPT_CAPABLE_BUNDLE_IDS } from './browserUrl'

/**
 * AppleScript one-liners for the active tab URL, keyed by bundle id. Each
 * targets the frontmost window/tab of that specific app (not "whatever is
 * frontmost"), so a stale result from a backgrounded browser is never
 * possible even if focus changes between the active-win poll and this call.
 */
const APPLESCRIPT_BY_BUNDLE_ID: ReadonlyMap<string, string> = new Map([
  ['com.apple.Safari', 'tell application "Safari" to return URL of front document'],
  ['com.google.Chrome', 'tell application "Google Chrome" to return URL of active tab of front window'],
  ['com.microsoft.edgemac', 'tell application "Microsoft Edge" to return URL of active tab of front window'],
  ['com.brave.Browser', 'tell application "Brave Browser" to return URL of active tab of front window'],
  ['company.thebrowser.Browser', 'tell application "Arc" to return URL of active tab of front window'],
])

/**
 * The AppleScript fallback (#22, ADR-0002): used only when the extension
 * isn't reporting and only for the AppleScript-capable browsers. Not
 * unit-tested, same as active-win/powerMonitor themselves (PRD Seam ②) —
 * this shells out to `osascript`, which only exists on macOS.
 */
export function getAppleScriptUrl(bundleId: string): Promise<string | null> {
  if (process.platform !== 'darwin' || !APPLESCRIPT_CAPABLE_BUNDLE_IDS.has(bundleId)) {
    return Promise.resolve(null)
  }
  const script = APPLESCRIPT_BY_BUNDLE_ID.get(bundleId)
  if (!script) return Promise.resolve(null)

  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], (error, stdout) => {
      if (error) {
        resolve(null)
        return
      }
      const url = stdout.trim()
      resolve(url === '' ? null : url)
    })
  })
}
