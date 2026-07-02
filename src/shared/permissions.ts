import type { Heartbeat } from './heartbeat'

/** Mirrors node-mac-permissions' `getAuthStatus('screen')` result, normalized to camelCase. */
export type ScreenRecordingStatus = 'authorized' | 'denied' | 'restricted' | 'not-determined'

export interface AppSettings {
  /** When on, the tracker never requests Screen Recording and Heartbeats carry no window title. */
  appLevelOnly: boolean
  /** The per-install token (#22) the browser extension must present to the localhost WS server. */
  wsToken: string
  /** The tray's privacy-pause toggle (#30): when on, Heartbeat collection halts entirely. */
  trackingPaused: boolean
}

/** The renderer's read of where window-title capture stands right now (#21). */
export interface PermissionsStatus {
  appLevelOnly: boolean
  screenRecordingStatus: ScreenRecordingStatus
  /** True when titles are expected but recent Heartbeats show the grant has silently lapsed. */
  silentLapseDetected: boolean
}

const DEFAULT_MIN_SAMPLE_SIZE = 5

/**
 * Silent-degradation detection (#21): macOS can revoke a previously-granted
 * Screen Recording permission without the app ever seeing a "denied" status
 * change — `active-win` just quietly stops returning titles. If the grant is
 * expected to be active (not App-level-only) but no recent Heartbeat carries
 * a title, treat it as lapsed and guide the user to re-enable it rather than
 * silently losing title data.
 *
 * Requires at least `minSampleSize` recent Heartbeats before judging, so a
 * handful of untitled system dialogs right after launch don't false-positive.
 */
export function detectSilentPermissionLapse(
  recentHeartbeats: readonly Pick<Heartbeat, 'windowTitle'>[],
  options: { appLevelOnly: boolean; minSampleSize?: number },
): boolean {
  if (options.appLevelOnly) return false
  const minSampleSize = options.minSampleSize ?? DEFAULT_MIN_SAMPLE_SIZE
  if (recentHeartbeats.length < minSampleSize) return false
  return recentHeartbeats.every((heartbeat) => heartbeat.windowTitle === null)
}
