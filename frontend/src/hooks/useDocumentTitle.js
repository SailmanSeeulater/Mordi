import { useEffect } from 'react';

const BASE = 'Mordi';

/**
 * Sets document.title for the page that calls it.
 *
 *   useDocumentTitle()              -> "Mordi"
 *   useDocumentTitle('Dashboard')   -> "Mordi — Dashboard"
 *
 * Restores the previous title on unmount so navigating away
 * never leaves a stale title behind.
 */
export default function useDocumentTitle(page) {
  useEffect(() => {
    const previous = document.title;
    document.title = page ? `${BASE} — ${page}` : BASE;
    return () => {
      document.title = previous;
    };
  }, [page]);
}