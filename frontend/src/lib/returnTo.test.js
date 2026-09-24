import { describe, expect, it } from 'vitest';
import { returnPath } from './returnTo';

describe('returnPath', () => {
  it('goes back to the page that asked for sign-in, hash and all', () => {
    expect(returnPath({ from: { pathname: '/join', search: '', hash: '#abc' } })).toBe('/join#abc');
    expect(returnPath({ from: { pathname: '/together/4', search: '?x=1', hash: '' } })).toBe('/together/4?x=1');
  });

  it('falls back to the dashboard for anything else', () => {
    expect(returnPath(null)).toBe('/dashboard');
    expect(returnPath({})).toBe('/dashboard');
    expect(returnPath({ from: { pathname: '//evil.example/x' } })).toBe('/dashboard');
    expect(returnPath({ from: { pathname: 'https://evil.example' } })).toBe('/dashboard');
    expect(returnPath({ from: { pathname: '/login' } })).toBe('/dashboard');
  });
});
