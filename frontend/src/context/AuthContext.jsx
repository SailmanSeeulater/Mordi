import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./auth-context-value";
import client, { SESSION_EXPIRED } from "../api/client";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = (userData, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
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
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
