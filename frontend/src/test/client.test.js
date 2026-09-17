import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import client, { SESSION_EXPIRED } from '../api/client';

/*
 * The API client's session renewal, against a fake transport. Every request
 * goes through `route`, which each test fills in; `calls` records what was
 * actually sent, in order.
 */

let calls;
let route;
const originalAdapter = client.defaults.adapter;

function respond(config, status, data = {}) {
  const response = { status, statusText: '', data, headers: {}, config };
  if (status >= 200 && status < 300) return Promise.resolve(response);
  // A custom adapter has to reject non-2xx itself; axios only applies
  // validateStatus inside its built-in adapters.
  return Promise.reject(
    new AxiosError(`Request failed with status code ${status}`, null, config, null, response),
  );
}

beforeEach(() => {
  localStorage.clear();
  calls = [];
  route = () => ({ status: 200 });
  client.defaults.adapter = (config) => {
    calls.push({ url: config.url, auth: config.headers?.Authorization ?? null });
    const { status, data } = route(config, calls.length);
    return respond(config, status, data);
  };
});

afterEach(() => {
  client.defaults.adapter = originalAdapter;
});

const refreshCalls = () => calls.filter((c) => c.url === '/api/auth/refresh').length;

/** An API that accepts only `good-token`, and hands one out on refresh. */
function apiWithExpiredToken({ refreshStatus = 200 } = {}) {
  return (config) => {
    if (config.url === '/api/auth/refresh') {
      return refreshStatus === 200
        ? { status: 200, data: { token: 'good-token', email: 'me@mordi.com', name: 'Me' } }
        : { status: refreshStatus, data: { error: 'Session expired. Sign in again.' } };
    }
    return config.headers?.Authorization === 'Bearer good-token'
      ? { status: 200, data: { ok: config.url } }
      : { status: 401 };
  };
}

describe('the request interceptor', () => {
  it('sends the stored access token', async () => {
    localStorage.setItem('token', 'abc');
    await client.get('/api/goals');
    expect(calls[0].auth).toBe('Bearer abc');
  });

  it('sends no Authorization header when signed out', async () => {
    await client.get('/api/goals');
    expect(calls[0].auth).toBeNull();
  });
});

describe('renewing an expired session', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify({ email: 'me@mordi.com', name: 'Me' }));
  });

  it('refreshes once and retries the request with the new token', async () => {
    route = apiWithExpiredToken();

    const res = await client.get('/api/goals');

    expect(res.data).toEqual({ ok: '/api/goals' });
    expect(calls.map((c) => c.url)).toEqual(['/api/goals', '/api/auth/refresh', '/api/goals']);
    expect(calls[2].auth).toBe('Bearer good-token');
  });

  it('stores the renewed token and user, so the next request uses them directly', async () => {
    route = apiWithExpiredToken();

    await client.get('/api/goals');
    expect(localStorage.getItem('token')).toBe('good-token');
    expect(JSON.parse(localStorage.getItem('user'))).toEqual({ email: 'me@mordi.com', name: 'Me' });

    calls = [];
    await client.get('/api/notes');
    expect(calls.map((c) => c.url)).toEqual(['/api/notes']);
  });

  it('shares one refresh between requests that expire at the same time', async () => {
    // The dashboard loads goals and entries in parallel. Two refreshes would
    // present a cookie the first had already rotated, which the server treats
    // as theft and answers by revoking the whole session.
    route = apiWithExpiredToken();

    const [goals, entries, notes] = await Promise.all([
      client.get('/api/goals'),
      client.get('/api/behaviors/range'),
      client.get('/api/notes'),
    ]);

    expect(refreshCalls()).toBe(1);
    expect([goals.data.ok, entries.data.ok, notes.data.ok]).toEqual([
      '/api/goals',
      '/api/behaviors/range',
      '/api/notes',
    ]);
  });

  it('starts a new refresh for a later expiry, once the previous one has settled', async () => {
    route = apiWithExpiredToken();
    await client.get('/api/goals');

    localStorage.setItem('token', 'expired-again');
    await client.get('/api/goals');

    expect(refreshCalls()).toBe(2);
  });
});

describe('when the session cannot be renewed', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify({ email: 'me@mordi.com', name: 'Me' }));
  });

  it('rejects with the original 401, not the refresh failure', async () => {
    route = apiWithExpiredToken({ refreshStatus: 401 });

    const error = await client.get('/api/goals').catch((e) => e);

    expect(error.response.status).toBe(401);
    expect(error.config.url).toBe('/api/goals');
  });

  it('clears the stored session and announces that it has ended', async () => {
    route = apiWithExpiredToken({ refreshStatus: 401 });
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED, expired);

    await client.get('/api/goals').catch(() => {});

    window.removeEventListener(SESSION_EXPIRED, expired);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('treats a refresh that returns no token as a failure', async () => {
    route = (config) =>
      config.url === '/api/auth/refresh' ? { status: 200, data: {} } : { status: 401 };
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED, expired);

    await expect(client.get('/api/goals')).rejects.toBeTruthy();

    window.removeEventListener(SESSION_EXPIRED, expired);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('ends the session once, however many requests were waiting on the refresh', async () => {
    route = apiWithExpiredToken({ refreshStatus: 401 });
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED, expired);

    await Promise.allSettled([client.get('/api/goals'), client.get('/api/notes')]);

    window.removeEventListener(SESSION_EXPIRED, expired);
    expect(refreshCalls()).toBe(1);
    expect(expired).toHaveBeenCalledTimes(1);
  });
});

describe('what is never retried', () => {
  it('a failed sign-in, which is a wrong password rather than an expired session', async () => {
    route = () => ({ status: 401 });

    const error = await client.post('/api/auth/login', {}).catch((e) => e);

    expect(error.response.status).toBe(401);
    expect(refreshCalls()).toBe(0);
  });

  it('the refresh call itself, so a dead cookie cannot loop', async () => {
    route = () => ({ status: 401 });

    await client.post('/api/auth/refresh').catch(() => {});

    expect(calls).toHaveLength(1);
  });

  it('a request that is refused again after a successful refresh', async () => {
    // The fresh token is accepted by refresh but refused by the endpoint:
    // retrying again would only repeat the same refusal.
    route = (config) =>
      config.url === '/api/auth/refresh'
        ? { status: 200, data: { token: 'good-token', email: 'me@mordi.com', name: 'Me' } }
        : { status: 401 };

    const error = await client.get('/api/goals').catch((e) => e);

    expect(error.response.status).toBe(401);
    expect(calls.map((c) => c.url)).toEqual(['/api/goals', '/api/auth/refresh', '/api/goals']);
  });

  it('anything that is not a 401', async () => {
    route = () => ({ status: 500 });

    const error = await client.get('/api/goals').catch((e) => e);

    expect(error.response.status).toBe(500);
    expect(refreshCalls()).toBe(0);
  });

  it('a 403, which means not allowed rather than not signed in', async () => {
    route = () => ({ status: 403 });

    await client.get('/api/goals').catch(() => {});

    expect(refreshCalls()).toBe(0);
  });
});
