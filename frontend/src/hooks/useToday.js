import { useEffect, useState } from 'react';
import { addDays, toIsoDate } from '../pages/dashboardData';

// The current local date, refreshed at midnight and whenever the tab regains
// focus (timers don't fire while a laptop sleeps).
export default function useToday() {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const sync = () => {
      const now = new Date();
      setToday((prev) => (toIsoDate(prev) === toIsoDate(now) ? prev : now));
    };

    const now = new Date();
    const timer = setTimeout(sync, addDays(now, 1) - now + 1000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [today]);

  return today;
}
