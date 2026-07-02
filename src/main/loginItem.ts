import { app } from 'electron'

/**
 * Launch-at-login (#30). Electron's login item API backs onto `SMAppService`
 * for the default `mainAppService` type on macOS 13+, so there's no local
 * setting to persist or drift from the OS — macOS itself is the source of
 * truth, and this always reads it live. Opt-in only: `openAtLogin` defaults
 * to `false` and nothing here is ever called until the user asks.
 */
export function isLaunchAtLoginEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin
}

export function setLaunchAtLoginEnabled(value: boolean): void {
  app.setLoginItemSettings({ openAtLogin: value })
}
