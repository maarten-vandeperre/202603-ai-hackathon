import { NavLink, Outlet } from 'react-router-dom'
import './Layout.css'

export default function Layout() {
  return (
    <div className="layout">
      <nav className="nav" aria-label="Main">
        <div className="nav__brand">Document App</div>
        <ul className="nav__list">
          <li>
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            >
              Docling
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/medical-analysis"
              className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            >
              ClinIQ
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/document-inspector"
              className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            >
              Document Inspector
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/artist-data"
              className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            >
              Artist Data
            </NavLink>
          </li>
        </ul>
      </nav>
      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  )
}
