import { NavLink, Outlet } from 'react-router-dom'
import './Layout.css'

export default function Layout() {
  return (
    <div className="layout">
      <nav className="nav" aria-label="Main">
        <div className="nav__brand">ClinIQ</div>
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
              Medical Reports
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
          <li>
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            >
              Admin
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/audit"
              className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            >
              Audit
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
