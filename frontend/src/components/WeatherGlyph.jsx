/**
 * Weather glyphs, drawn rather than imported.
 *
 * Each one is a flat filled shape in currentColor, so it sits in the same
 * matte material as the cards instead of looking like a line icon borrowed
 * from a different set. The pieces are plain functions returning markup, not
 * nested components: a component declared during render is a new type on
 * every render.
 */
function disc(isDay) {
  return (
    <>
      <circle cx="9.5" cy="9.5" r="5.4" fill="currentColor" fillOpacity="0.9" />
      {isDay && (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
          <path d="M9.5 1v1.8M9.5 16.2V18M1 9.5h1.8M16.2 9.5H18M3.5 3.5l1.3 1.3M14.2 14.2l1.3 1.3M15.5 3.5l-1.3 1.3M4.8 14.2L3.5 15.5" />
        </g>
      )}
    </>
  );
}

function cloud(y = 0) {
  return (
    <path
      transform={`translate(0 ${y})`}
      d="M7.4 21.5h11.1a4.1 4.1 0 00.3-8.2 6.2 6.2 0 00-11.7-1.3 3.8 3.8 0 00.3 9.5z"
      fill="currentColor"
      fillOpacity="0.85"
    />
  );
}

const drops = (
  <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" opacity="0.9">
    <path d="M9.5 24.5l-1 3M15 24.5l-1 3M20.5 24.5l-1 3" />
  </g>
);

const flakes = (
  <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
    <path d="M9 26h2.4M10.2 24.8v2.4M17.6 26H20M18.8 24.8v2.4" />
  </g>
);

const fogLines = (
  <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" opacity="0.8">
    <path d="M5 23.5h16M8 27h11" />
  </g>
);

const bolt = (
  <path
    d="M14.6 22.5l-3.1 4.6h2.6l-1 3.4 4.2-5.2h-2.5l1.1-2.8z"
    fill="currentColor"
    opacity="0.95"
  />
);

export default function WeatherGlyph({ kind, isDay = true, size = 34 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'clear' && <g transform="translate(5.5 5.5)">{disc(isDay)}</g>}

      {kind === 'partly' && (
        <>
          <g transform="translate(9 0)">{disc(isDay)}</g>
          {cloud(2)}
        </>
      )}

      {kind === 'cloud' && cloud(1)}

      {kind === 'fog' && (
        <>
          {cloud(-2)}
          {fogLines}
        </>
      )}

      {kind === 'rain' && (
        <>
          {cloud(-2)}
          {drops}
        </>
      )}

      {kind === 'snow' && (
        <>
          {cloud(-2)}
          {flakes}
        </>
      )}

      {kind === 'storm' && (
        <>
          {cloud(-2)}
          {bolt}
        </>
      )}
    </svg>
  );
}
