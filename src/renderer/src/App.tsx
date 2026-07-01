import { Today } from './Today'

/**
 * The dashboard shell. Today is the default (and, in slice 1, only) landing
 * surface; Trends and Settings arrive in later slices.
 */
export function App(): JSX.Element {
  return (
    <div className="app">
      <nav className="app__nav" aria-label="Primary">
        <span className="app__brand">Time Tracker</span>
        <ul className="app__nav-list">
          <li className="app__nav-item app__nav-item--active" aria-current="page">
            Today
          </li>
          <li className="app__nav-item app__nav-item--disabled" aria-disabled="true">
            Trends
          </li>
          <li className="app__nav-item app__nav-item--disabled" aria-disabled="true">
            Settings
          </li>
        </ul>
      </nav>
      <main className="app__main">
        <Today />
      </main>
    </div>
  )
}
