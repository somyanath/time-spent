import { Today } from './views/Today'

/**
 * Root of the dashboard. Today is the default landing surface (PRD: "Today to
 * be the default landing surface"). Trends and Settings arrive in later slices.
 */
export function App(): React.JSX.Element {
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">Time Tracker</div>
        <ul className="nav-list">
          <li className="nav-item nav-item--active">Today</li>
          <li className="nav-item nav-item--disabled">Trends</li>
          <li className="nav-item nav-item--disabled">Settings</li>
        </ul>
      </nav>
      <main className="content">
        <Today />
      </main>
    </div>
  )
}
