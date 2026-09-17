import { useEffect, useState } from 'react';

const format = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * The time, beside the weather on the week card.
 *
 * It ticks once a minute, on the minute: a timer that runs every second would
 * redraw the card sixty times to change one digit, and a plain 60-second
 * interval started at an arbitrary moment would show the old minute for up to
 * a minute after it changed. So each tick schedules the next for the start of
 * the following minute.
 *
 * The format comes from the browser's locale, so it is 12- or 24-hour wherever
 * that is the everyday convention. It is not a live region: announcing every
 * minute would be noise.
 */
export default function ClockChip() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    const schedule = () => {
      const current = new Date();
      const untilNextMinute = 60_000 - (current.getSeconds() * 1000 + current.getMilliseconds());
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, untilNextMinute + 20);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <time className="wx wx--clock" dateTime={now.toISOString()}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
      {format.format(now)}
    </time>
  );
}
