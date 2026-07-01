import { shell } from 'electron'
import type { ScreenRecordingStatus } from '../shared/permissions'

const SCREEN_RECORDING_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

/**
 * node-mac-permissions is a darwin-only native module (its `os` field blocks
 * install elsewhere), so it's require()'d lazily and only ever reached at
 * runtime on macOS — never at module-load time, so this file stays safe to
 * import from anywhere without dragging in a native addon that doesn't exist
 * on the dev/CI platform.
 */
function loadNativeModule(): typeof import('node-mac-permissions') | null {
  if (process.platform !== 'darwin') return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node-mac-permissions')
}

/** Checks the current Screen Recording TCC grant without prompting. */
export function getScreenRecordingStatus(): ScreenRecordingStatus {
  const native = loadNativeModule()
  if (!native) return 'not-determined'
  const status = native.getAuthStatus('screen')
  return status === 'not determined' ? 'not-determined' : status
}

/** Triggers the OS permission prompt (only effective the first time; a denied grant must be flipped in System Settings). */
export function requestScreenRecordingAccess(): void {
  loadNativeModule()?.askForScreenCaptureAccess()
}

/** Deep link + the quit-and-relaunch guidance macOS requires to actually pick up a freshly-granted permission. */
export function openScreenRecordingSettings(): Promise<void> {
  return shell.openExternal(SCREEN_RECORDING_SETTINGS_URL).then(() => undefined)
}
