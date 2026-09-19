import { useEffect, useState } from 'react';

const format = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * The time, beside the weather on the week card, to the second.
 *
 * Each tick is scheduled for the start of the next second rather than on a
 * plain one-second interval: an interval started at an arbitrary moment shows
 * each second up to a second late, and drifts further every time the browser
 * throttles it. Re-aiming at the boundary on every tick keeps the digit
 * turning over with the system clock.
 *
 * The format comes from the browser's locale, so it is 12- or 24-hour wherever
 * that is the everyday convention. The digits are tabular (see .wx--clock), so
 * the chip does not twitch in width every second. It is not a live region:
 * announcing every second would be noise.
 */
export default function ClockChip() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    const schedule = () => {
      const untilNextSecond = 1000 - new Date().getMilliseconds();
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, untilNextSecond + 5);
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
