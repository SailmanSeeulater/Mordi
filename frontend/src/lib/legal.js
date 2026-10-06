/**
 * The facts the Terms and Privacy Policy are built on, in one place.
 *
 * `version` is recorded against every new account as the Terms it agreed to.
 * Bump it, and `updated`, whenever either page changes in substance, and bump
 * TERMS_VERSION in the backend's AuthService to match (a test checks).
 */
export const LEGAL = {
  operator: 'Perfect Phanitchaleun',
  state: 'California',
  contact: 'privacy@latesailor.dev',
  site: 'mordi.latesailor.dev',
  version: '2026-10-02',
  updated: 'October 2, 2026',
  minimumAge: 13,
};

export const GOOGLE_MAPS_TERMS = 'https://maps.google.com/help/terms_maps/';
export const GOOGLE_PRIVACY = 'https://policies.google.com/privacy';
