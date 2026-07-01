/// <reference types="vite/client" />

import type { TimeTrackerApi } from '../../shared/api'

declare global {
  interface Window {
    /**
     * Exposed by the preload bridge (see src/preload/index.ts). Optional so the
     * renderer stays defensible if it is ever loaded without the preload (tests,
     * a browser preview), matching the runtime guard in components.
     */
    timeTracker?: TimeTrackerApi
  }
}

export {}
