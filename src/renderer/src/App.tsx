import { useState } from 'react'
import { Settings } from './Settings'
import { Today } from './Today'

type View = 'today' | 'settings'

/**
 * The dashboard shell. Today is the default landing surface; Settings
 * (Categories + Rules, #18) is the second live surface. Trends arrives in a
 * later slice.
 */
export function App(): JSX.Element {
  const [view, setView] = useState<View>('today')

  return (
    <div className="app">
      <nav className="app__nav" aria-label="Primary">
        <span className="app__brand">Time Tracker</span>
        <ul className="app__nav-list">
          <li
            className={`app__nav-item${view === 'today' ? ' app__nav-item--active' : ''}`}
            aria-current={view === 'today' ? 'page' : undefined}
          >
            <button type="button" className="app__nav-link" onClick={() => setView('today')}>
              Today
            </button>
          </li>
          <li className="app__nav-item app__nav-item--disabled" aria-disabled="true">
            Trends
          </li>
          <li
            className={`app__nav-item${view === 'settings' ? ' app__nav-item--active' : ''}`}
            aria-current={view === 'settings' ? 'page' : undefined}
          >
            <button type="button" className="app__nav-link" onClick={() => setView('settings')}>
              Settings
            </button>
          </li>
        </ul>
      </nav>
      <main className="app__main">{view === 'today' ? <Today /> : <Settings />}</main>
    </div>
  )
}
