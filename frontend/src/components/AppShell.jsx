import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import './app.css';

const svgProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  'aria-hidden': true,
  focusable: false,
};

const IconDashboard = () => (
  <svg {...svgProps}>
    <rect x="3" y="3" width="7" height="9" />
    <rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" />
    <rect x="3" y="16" width="7" height="5" />
  </svg>
);
const IconGoals = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);
const IconLocations = () => (
  <svg {...svgProps}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconReport = () => (
  <svg {...svgProps}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);
const IconSettings = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1A1.7 1.7 0 007 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 13.7H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010 3.1V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);

const RAIL_LINKS = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/goals', label: 'Goals', Icon: IconGoals },
  { to: '/locations', label: 'Locations', Icon: IconLocations },
  { to: '/reports', label: 'Weekly report', Icon: IconReport },
];
const TAB_LINKS = RAIL_LINKS.slice(0, 3);

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.name?.trim() || '';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <nav className="app-rail" aria-label="Sections">
        <Link to="/dashboard" className="app-rail__mark" aria-label="Mordi dashboard">
          M
        </Link>
        {RAIL_LINKS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="app-rail__link"
            aria-label={item.label}
            title={item.label}
          >
            <item.Icon />
          </NavLink>
        ))}
        <div className="app-rail__spacer" />
        <NavLink to="/settings" className="app-rail__link" aria-label="Settings" title="Settings">
          <IconSettings />
        </NavLink>
      </nav>

      <div className="app-body">
        <header className="app-topbar">
          <nav className="app-tabs" aria-label="Primary">
            {TAB_LINKS.map((item) => (
              <NavLink key={item.to} to={item.to} className="app-tab">
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="app-topbar__spacer" />
          <div className="app-whoami">
            <span className="app-avatar" aria-hidden="true">
              {name ? name[0].toUpperCase() : '?'}
            </span>
            <span className="app-whoami__name">{name}</span>
            <button type="button" className="app-linkbtn" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
