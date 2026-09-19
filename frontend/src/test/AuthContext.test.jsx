import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import { useAuth } from '../context/useAuth';
import client, { SESSION_EXPIRED } from '../api/client';

let calls;
const originalAdapter = client.defaults.adapter;

beforeEach(() => {
  localStorage.clear();
  calls = [];
  client.defaults.adapter = (config) => {
    calls.push(config.url);
    return Promise.resolve({ status: 204, statusText: '', data: '', headers: {}, config });
  };
});

afterEach(() => {
  client.defaults.adapter = originalAdapter;
});

function Probe() {
  const { user, logout } = useAuth();
  return (
    <>
      <span data-testid="who">{user ? user.email : 'signed out'}</span>
      <button type="button" onClick={logout}>
        Log out
      </button>
    </>
  );
}

function signedIn() {
  localStorage.setItem('token', 'access');
  localStorage.setItem('user', JSON.stringify({ email: 'me@mordi.com', name: 'Me' }));
}

describe('AuthProvider', () => {
  it('restores a stored session on load', () => {
    signedIn();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId('who')).toHaveTextContent('me@mordi.com');
  });

  it('drops the user when the API client reports the session could not be renewed', () => {
    // This is what sends a protected page back to sign-in, instead of leaving
    // it stuck on "Couldn't load your week".
    signedIn();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED));
    });

    expect(screen.getByTestId('who')).toHaveTextContent('signed out');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('stops listening once unmounted', () => {
    signedIn();
    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    unmount();

    // Would throw a state update on an unmounted tree if the listener leaked.
    expect(() => window.dispatchEvent(new Event(SESSION_EXPIRED))).not.toThrow();
  });

  it('revokes the refresh token on the server when logging out', async () => {
    signedIn();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByText('Log out').click();
    });

    expect(calls).toContain('/api/auth/logout');
    expect(screen.getByTestId('who')).toHaveTextContent('signed out');
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('still logs out locally when the server cannot be reached', async () => {
    signedIn();
    client.defaults.adapter = () => Promise.reject(new Error('offline'));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByText('Log out').click();
    });

    expect(screen.getByTestId('who')).toHaveTextContent('signed out');
  });

  it('signs back in from a live refresh cookie when nothing is stored', async () => {
    // Local storage cleared, cookie still valid: go straight in, no sign-in page.
    client.defaults.adapter = (config) => {
      calls.push(config.url);
      return Promise.resolve({
        status: 200, statusText: '', headers: {}, config,
        data: { token: 'fresh', email: 'me@mordi.com', name: 'Me' },
      });
    };
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('me@mordi.com')).toBeInTheDocument();
    expect(calls).toEqual(['/api/auth/refresh']);
  });

  it('does not sign back in after the person logged out on purpose', async () => {
    signedIn();
    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      screen.getByText('Log out').click();
    });
    unmount();
    calls = [];

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId('who')).toHaveTextContent('signed out');
    expect(calls).not.toContain('/api/auth/refresh');
  });
});
