/**
 * Page-visit counting through Umami Cloud, which sets no cookies and keeps
 * no identifier for a person. Off unless VITE_UMAMI_WEBSITE_ID is set at
 * build time, so local runs and forks count nothing. The Privacy Policy
 * names Umami; changing what is sent here changes that page and its version.
 *
 * Mordi never tells Umami who anyone is: there is no identify call, and the
 * only event is the one `track` is given.
 */

const SCRIPT_SRC = 'https://cloud.umami.is/script.js';

/**
 * Adds Umami's script to the page, once. The script counts a visit by the
 * page address, leaving off the query string and hash (a reset link carries
 * its token in the hash), only on the live site's own domain, and not at all
 * for browsers that send Do Not Track.
 */
export function startAnalytics(websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID) {
  if (!websiteId || document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = SCRIPT_SRC;
  script.setAttribute('data-website-id', websiteId);
  script.setAttribute('data-domains', 'mordi.latesailor.dev');
  script.setAttribute('data-exclude-search', 'true');
  script.setAttribute('data-exclude-hash', 'true');
  script.setAttribute('data-do-not-track', 'true');
  document.head.appendChild(script);
}

/** Records a named event with no properties. Does nothing if Umami is not on the page. */
export function track(eventName) {
  try {
    window.umami?.track(eventName);
  } catch {
    // Counting is never worth breaking the page for.
  }
}
