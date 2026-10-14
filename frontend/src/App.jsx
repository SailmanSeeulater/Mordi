import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

// The dashboard is what a returning visit opens, and returning visits are the
// repeated ones, so it ships in the first bundle. The landing page is the
// other half of a cold load, but a session only ever renders one of the two:
// it loads on its own, with its stylesheet, so a signed-in day never pays for
// it. Everything else loads on first visit to its page: the map, the calendar
// and the reports each carry weight the dashboard should not pay for.
const Landing = lazy(() => import("./pages/Landing"));
const Goals = lazy(() => import("./pages/Goals"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportWeek = lazy(() => import("./pages/ReportWeek"));
const Locations = lazy(() => import("./pages/Locations"));
const History = lazy(() => import("./pages/History"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Notes = lazy(() => import("./pages/Notes"));
const Together = lazy(() => import("./pages/Together"));
const Join = lazy(() => import("./pages/Join"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const About = lazy(() => import("./pages/About"));
const AdminUsage = lazy(() => import("./pages/AdminUsage"));
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { useAuth } from "./context/useAuth";
import { useTheme } from "./context/useTheme";

/**
 * What shows while a page's code is still arriving: the ground in the
 * person's own colour combination, so a dark theme never flashes the default
 * Sorbet the body is painted with before any page sets its theme.
 */
function ThemedGround() {
  const { theme } = useTheme();
  return <div data-theme={theme} style={{ minHeight: "100svh", background: "var(--color-bg)" }} />;
}

function PrivateRoute({ children }) {
  const { user, restoring } = useAuth();
  const location = useLocation();
  // While a stored-nothing load is still trying the refresh cookie, render
  // nothing rather than bouncing a signed-in person to the sign-in page.
  if (restoring) return null;
  // Remember where they were headed (an invite link, say), so signing in or
  // signing up brings them back to it.
  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
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
        <Suspense fallback={<ThemedGround />}>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
          {/* Not PublicOnly: the emailed link has to work even in a browser
              that is signed in, and the page signs it out itself. */}
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Public, like the Terms and Privacy pages it sits beside. */}
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
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
            path="/notes"
            element={
              <PrivateRoute>
                <Notes />
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
          <Route
            path="/together"
            element={
              <PrivateRoute>
                <Together />
              </PrivateRoute>
            }
          />
          <Route
            path="/together/:goalId"
            element={
              <PrivateRoute>
                <Together />
              </PrivateRoute>
            }
          />
          <Route
            path="/join"
            element={
              <PrivateRoute>
                <Join />
              </PrivateRoute>
            }
          />
          {/* Linked from nowhere: the owner types the address. The page
              answers anyone else the way an unknown address is answered. */}
          <Route
            path="/admin/usage"
            element={
              <PrivateRoute>
                <AdminUsage />
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
