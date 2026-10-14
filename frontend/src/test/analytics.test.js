import { describe, it, expect, vi, afterEach } from 'vitest';
import { startAnalytics, track } from '../lib/analytics';

const scripts = () => document.head.querySelectorAll('script[src*="umami"]');

afterEach(() => {
  scripts().forEach((s) => s.remove());
  delete window.umami;
});

describe('startAnalytics', () => {
  it('adds nothing without a website id', () => {
    startAnalytics('');
    startAnalytics(undefined);
    expect(scripts()).toHaveLength(0);
  });

  it('adds Umami once, cookieless, on the live domain, without query or hash', () => {
    startAnalytics('abc-123');
    startAnalytics('abc-123');

    expect(scripts()).toHaveLength(1);
    const script = scripts()[0];
    expect(script.getAttribute('src')).toBe('https://cloud.umami.is/script.js');
    expect(script.defer).toBe(true);
    expect(script.dataset.websiteId).toBe('abc-123');
    expect(script.dataset.domains).toBe('mordi.latesailor.dev');
    expect(script.dataset.excludeSearch).toBe('true');
    expect(script.dataset.excludeHash).toBe('true');
    expect(script.dataset.doNotTrack).toBe('true');
  });
});

describe('track', () => {
  it('sends the event name and nothing else', () => {
    window.umami = { track: vi.fn(), identify: vi.fn() };
    track('Sign up');
    expect(window.umami.track).toHaveBeenCalledTimes(1);
    expect(window.umami.track).toHaveBeenCalledWith('Sign up');
    expect(window.umami.identify).not.toHaveBeenCalled();
  });

  it('does nothing when Umami is not on the page', () => {
    expect(() => track('Sign up')).not.toThrow();
  });

  it('never lets a failing counter break the page', () => {
    window.umami = {
      track: () => {
        throw new Error('blocked');
      },
    };
    expect(() => track('Sign up')).not.toThrow();
  });
});
