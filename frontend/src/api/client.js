import axios from "axios";

/** Fired when the session cannot be renewed; AuthProvider listens for it. */
export const SESSION_EXPIRED = "mordi:session-expired";

const client = axios.create({
  baseURL: "",
  // The refresh token travels in an httpOnly cookie. Same-origin requests send
  // it anyway; this keeps that true if the API ever moves to a subdomain.
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/*
 * Keeping someone signed in.
 *
 * The access token lasts fifteen minutes. When a request comes back 401, the
 * refresh cookie is traded for a new access token and the request is sent
 * again, so the person never sees the expiry. Only if the refresh itself fails
 * — the cookie is missing, expired, or has been revoked — is the session over.
 *
 * One refresh at a time. The dashboard loads goals and entries in parallel, so
 * an expired token produces two 401s at once; without sharing the in-flight
 * refresh, the second would present a cookie the first had already rotated,
 * which the server treats as a stolen token and revokes the whole session.
 */
let refreshing = null;

function endSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event(SESSION_EXPIRED));
}

function refreshSession() {
  if (!refreshing) {
    refreshing = client
      .post("/api/auth/refresh")
      .then((res) => {
        const { token, email, name } = res.data ?? {};
        if (!token) throw new Error("refresh returned no token");
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify({ email, name }));
        return token;
      })
      .catch((error) => {
        // Here rather than in each waiting request, so the session ends once
        // however many requests were queued behind the refresh.
        endSession();
        throw error;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/**
 * Whether this browser still holds a live session, for a load with nothing in
 * local storage. The refresh cookie is httpOnly, so script cannot look for it;
 * the only way to know is to try it. Resolves to the user, or null.
 *
 * Shares the single in-flight refresh with the interceptor, so a page that
 * also fires requests on mount cannot present the same cookie twice.
 */
export function restoreSession() {
  return refreshSession()
    .then(() => {
      try {
        return JSON.parse(localStorage.getItem("user") ?? "null");
      } catch {
        return null;
      }
    })
    .catch(() => null);
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    const retryable =
      response?.status === 401 &&
      config &&
      // Never for the auth endpoints themselves: a failed sign-in is a wrong
      // password, and a failed refresh must not try to refresh.
      !String(config.url ?? "").startsWith("/api/auth/") &&
      // Once per request. If the fresh token is refused too, stop.
      !config._retried;

    if (!retryable) {
      return Promise.reject(error);
    }

    config._retried = true;
    let token;
    try {
      token = await refreshSession();
    } catch {
      // The session has already been ended by refreshSession. Reject with the
      // original 401 so callers see the request that failed, not the refresh.
      return Promise.reject(error);
    }
    config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    return client(config);
  },
);

export default client;
