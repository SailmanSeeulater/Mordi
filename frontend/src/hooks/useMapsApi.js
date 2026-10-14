import { useEffect, useState } from 'react';
import { loadMapsLibrary } from '../lib/maps';

/**
 * Whether the Maps JavaScript API is on the page yet, in the shape the
 * component tree already reads: { isLoaded, loadError }. Without a key the
 * map reports a load error and the rest of the page carries on.
 */
export default function useMapsApi() {
  const [state, setState] = useState({ isLoaded: false, loadError: undefined });

  useEffect(() => {
    let mounted = true;
    loadMapsLibrary('maps').then(
      () => mounted && setState({ isLoaded: true, loadError: undefined }),
      (error) => mounted && setState({ isLoaded: false, loadError: error }),
    );
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
