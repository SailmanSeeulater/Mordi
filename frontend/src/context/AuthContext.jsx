import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./auth-context-value";
import client, { SESSION_EXPIRED, restoreSession } from "../api/client";

/**
 * Set on Log out and cleared on sign-in. Logging out revokes the refresh
 * cookie on the server, but that request is fire-and-forget: if it never
 * arrived, the cookie is still live, and without this flag the next load would
 * quietly sign the person straight back in after they chose to leave.
 */
const SIGNED_OUT_KEY = "mordi-signed-out";

function readStoredUser() {
  try {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function signedOutOnPurpose() {
  try {
    return localStorage.getItem(SIGNED_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  // Nothing stored does not mean signed out. Local storage can be cleared
  // while the refresh cookie lives on for up to thirty days, so on a load with
  // no stored user the cookie is tried once before anyone is sent to sign in.
  const [restoring, setRestoring] = useState(
    () => !readStoredUser() && !signedOutOnPurpose(),
  );

  useEffect(() => {
    if (!restoring) return undefined;
    let live = true;
    restoreSession().then((restored) => {
      if (!live) return;
      if (restored) setUser(restored);
      setRestoring(false);
    });
    return () => {
      live = false;
    };
  }, [restoring]);

  const login = (userData, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.removeItem(SIGNED_OUT_KEY);
    setUser(userData);
  };

  const clear = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  const logout = () => {
    // Revoke the refresh token on the server as well, so the session is over
    // everywhere and not just in this tab. Signing out locally does not wait
    // on it: someone pressing Log out offline should still be logged out.
    client.post("/api/auth/logout").catch(() => {});
    try {
      localStorage.setItem(SIGNED_OUT_KEY, "1");
    } catch {
      // Blocked storage: the server-side revoke is then the only guard.
    }
    clear();
  };

  // The API client fires this when a session cannot be renewed. Dropping the
  // user here is what sends a protected page back to the sign-in screen,
  // instead of leaving it showing "Couldn't load" forever.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED, clear);
    return () => window.removeEventListener(SESSION_EXPIRED, clear);
  }, [clear]);

  return (
    <AuthContext.Provider value={{ user, restoring, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
