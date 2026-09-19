import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import ThemeSwitcher from './ThemeSwitcher';
import './app.css';

const svgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const IconDashboard = () => (
  <svg {...svgProps}>
    <rect x="3" y="4" width="18" height="7" rx="2.5" />
    <rect x="3" y="14" width="10" height="6" rx="2.5" />
    <rect x="16" y="14" width="5" height="6" rx="2.5" />
  </svg>
);
const IconGoals = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" />
  </svg>
);
const IconPlaces = () => (
  <svg {...svgProps}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
    <circle cx="12" cy="10" r="2.8" />
  </svg>
);
const IconReport = () => (
  <svg {...svgProps}>
    <path d="M5 20v-7M12 20V5M19 20v-4" />
  </svg>
);
const IconCalendar = () => (
  <svg {...svgProps}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
const IconHistory = () => (
  <svg {...svgProps}>
    <path d="M3.5 12a8.5 8.5 0 102.5-6" />
    <path d="M3 3.5V8h4.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
const IconNotes = () => (
  <svg {...svgProps}>
    <path d="M6 3.5h9l4 4v13H6z" />
    <path d="M14.5 3.5V8H19M9.5 12.5h6M9.5 16h4" />
  </svg>
);
const IconSettings = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.1 14.5a2 2 0 00.4 2.2 1.6 1.6 0 11-2.3 2.3 2 2 0 00-2.2-.4 2 2 0 00-1.2 1.8 1.6 1.6 0 11-3.2 0 2 2 0 00-1.3-1.8 2 2 0 00-2.2.4 1.6 1.6 0 11-2.3-2.3 2 2 0 00.4-2.2 2 2 0 00-1.8-1.2 1.6 1.6 0 110-3.2 2 2 0 001.8-1.3 2 2 0 00-.4-2.2 1.6 1.6 0 112.3-2.3 2 2 0 002.2.4h.1A2 2 0 0010.4 3a1.6 1.6 0 113.2 0 2 2 0 001.2 1.8 2 2 0 002.2-.4 1.6 1.6 0 112.3 2.3 2 2 0 00-.4 2.2v.1a2 2 0 001.8 1.2 1.6 1.6 0 110 3.2 2 2 0 00-1.8 1.2z" />
  </svg>
);

const NAV = [
  { to: '/dashboard', label: 'Today', Icon: IconDashboard },
  { to: '/calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/goals', label: 'Goals', Icon: IconGoals },
  { to: '/notes', label: 'Notes', Icon: IconNotes },
  { to: '/history', label: 'History', Icon: IconHistory },
  { to: '/locations', label: 'Places', Icon: IconPlaces },
  { to: '/reports', label: 'Report', Icon: IconReport },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
];

export default function AppShell({ title, action, children }) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const name = user?.name?.trim() || '';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app" data-theme={theme}>
      <nav className="app-rail" aria-label="Sections">
        <Link to="/dashboard" className="app-rail__mark" aria-label="Mordi">
          M
        </Link>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className="app-rail__link">
            <item.Icon />
            {item.label}
          </NavLink>
        ))}
        <div className="app-rail__spacer" />
      </nav>

      <div className="app-body">
        <header className="app-topbar">
          {title && <h1 className="app-topbar__title">{title}</h1>}
          <div className="app-topbar__spacer" />
          {action}
          <ThemeSwitcher />
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

      <nav className="app-tabbar" aria-label="Sections">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className="app-tabbar__link">
            <item.Icon />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
