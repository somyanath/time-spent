import { getAppleScriptUrl } from './appleScriptUrl'
import { resolveUrlSource } from './browserUrl'

export interface UrlResolverOptions {
  /** The extension server's latest reported URL, already null when stale. */
  getExtensionUrl: () => string | null
  /** Injectable so the composition (precedence + wiring) is testable without shelling out to osascript. */
  getAppleScriptUrl?: (bundleId: string) => Promise<string | null>
}

/**
 * Composes the Extension → AppleScript → none precedence (#22) into the
 * single async lookup `ActiveWinHeartbeatSource` calls per poll.
 */
export function createUrlResolver(
  options: UrlResolverOptions,
): (bundleId: string | null) => Promise<string | null> {
  const resolveAppleScriptUrl = options.getAppleScriptUrl ?? getAppleScriptUrl

  return async function resolveUrl(bundleId: string | null): Promise<string | null> {
    const extensionUrl = options.getExtensionUrl()
    const source = resolveUrlSource(bundleId, extensionUrl !== null)

    if (source === 'extension') return extensionUrl
    if (source === 'applescript' && bundleId) return resolveAppleScriptUrl(bundleId)
    return null
  }
}
