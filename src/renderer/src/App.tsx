import { useState } from 'react'
import { Settings } from './Settings'
import { Today } from './Today'
import { Trends } from './Trends'

type View = 'today' | 'trends' | 'settings'

/**
 * The dashboard shell. Today is the default landing surface; Trends (#28)
 * shows longer patterns; Settings (Categories + Rules, #18) rounds out the
 * three live surfaces.
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
          <li
            className={`app__nav-item${view === 'trends' ? ' app__nav-item--active' : ''}`}
            aria-current={view === 'trends' ? 'page' : undefined}
          >
            <button type="button" className="app__nav-link" onClick={() => setView('trends')}>
              Trends
            </button>
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
      <main className="app__main">
        {view === 'today' && <Today />}
        {view === 'trends' && <Trends />}
        {view === 'settings' && <Settings />}
      </main>
    </div>
  )
}
