import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Placeholder from './pages/Placeholder';

// The landing page and the dashboard are what almost every visit opens, so
// they ship in the first bundle. Everything else loads on first visit to its
// page: the map, the calendar and the reports each carry weight the
// dashboard should not pay for.
const Goals = lazy(() => import("./pages/Goals"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportWeek = lazy(() => import("./pages/ReportWeek"));
const Locations = lazy(() => import("./pages/Locations"));
const History = lazy(() => import("./pages/History"));
const Calendar = lazy(() => import("./pages/Calendar"));
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { useAuth } from "./context/useAuth";

function PrivateRoute({ children }) {
  const { user, restoring } = useAuth();
  // While a stored-nothing load is still trying the refresh cookie, render
  // nothing rather than bouncing a signed-in person to the sign-in page.
  if (restoring) return null;
  return user ? children : <Navigate to="/login" replace />;
}

/**
 * The landing and sign-in pages, for people who are not signed in. Someone
 * with a live session goes straight to their dashboard instead: that is what
 * they came for. Rendered immediately rather than waiting on a restore, so a
 * first-time visitor never stares at a blank page.
 */
function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/about" element={<Placeholder title="About" />} />
          <Route path="/privacy" element={<Placeholder title="Privacy" />} />
          <Route path="/terms" element={<Placeholder title="Terms" />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/goals"
            element={
              <PrivateRoute>
                <Goals />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivateRoute>
                <Reports />
              </PrivateRoute>
            }
          />
          <Route
            path="/locations"
            element={
              <PrivateRoute>
                <Locations />
              </PrivateRoute>
            }
          />
          <Route
            path="/reports/:week"
            element={
              <PrivateRoute>
                <ReportWeek />
              </PrivateRoute>
            }
          />
          <Route
            path="/history"
            element={
              <PrivateRoute>
                <History />
              </PrivateRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <PrivateRoute>
                <Calendar />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
