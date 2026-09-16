/**
 * Weather glyphs, drawn rather than imported.
 *
 * Each one is a filled shape with a lit top edge, so it sits in the same
 * material language as the glass panels instead of looking like a line icon
 * borrowed from a different set. The pieces are plain functions returning
 * markup, not nested components: a component declared during render is a new
 * type on every render.
 *
 * Gradient ids are namespaced per instance, because two of these can be on
 * the page at once.
 */
function disc(sunId, isDay) {
  return (
    <>
      <circle cx="9.5" cy="9.5" r="5.4" fill={`url(#${sunId})`} />
      {isDay && (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
          <path d="M9.5 1v1.8M9.5 16.2V18M1 9.5h1.8M16.2 9.5H18M3.5 3.5l1.3 1.3M14.2 14.2l1.3 1.3M15.5 3.5l-1.3 1.3M4.8 14.2L3.5 15.5" />
        </g>
      )}
    </>
  );
}

function cloud(cloudId, y = 0) {
  return (
    <path
      transform={`translate(0 ${y})`}
      d="M7.4 21.5h11.1a4.1 4.1 0 00.3-8.2 6.2 6.2 0 00-11.7-1.3 3.8 3.8 0 00.3 9.5z"
      fill={`url(#${cloudId})`}
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

export default function WeatherGlyph({ kind, isDay = true, size = 34, idSuffix = '' }) {
  const sunId = `wg-sun${idSuffix}`;
  const cloudId = `wg-cloud${idSuffix}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={sunId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id={cloudId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.92" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {kind === 'clear' && <g transform="translate(5.5 5.5)">{disc(sunId, isDay)}</g>}

      {kind === 'partly' && (
        <>
          <g transform="translate(9 0)">{disc(sunId, isDay)}</g>
          {cloud(cloudId, 2)}
        </>
      )}

      {kind === 'cloud' && cloud(cloudId, 1)}

      {kind === 'fog' && (
        <>
          {cloud(cloudId, -2)}
          {fogLines}
        </>
      )}

      {kind === 'rain' && (
        <>
          {cloud(cloudId, -2)}
          {drops}
        </>
      )}

      {kind === 'snow' && (
        <>
          {cloud(cloudId, -2)}
          {flakes}
        </>
      )}

      {kind === 'storm' && (
        <>
          {cloud(cloudId, -2)}
          {bolt}
        </>
      )}
    </svg>
  );
}
