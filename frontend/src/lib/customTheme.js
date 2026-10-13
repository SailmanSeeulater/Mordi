/* The three themes a person mixes themselves, and the color math behind them.

   A person picks four colors: the ground, the cards, the ink and the accent.
   The other roles every theme in themes.css sets are derived here, each one
   pushed toward the ink until it clears the same WCAG minimum the built-in
   themes are held to. The result is written as ordinary [data-theme] blocks,
   so a custom theme paints everything a built-in one does, swatches included. */

export const CUSTOM_STORAGE_KEY = 'mordi-custom-themes';

/** The four colors a person chooses, in editor order. */
export const CUSTOM_ROLES = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Cards' },
  { key: 'text', label: 'Text' },
  { key: 'accent', label: 'Accent' },
];

/* Distinct starting points, so the three slots are told apart before anyone
   has touched them. */
export const DEFAULT_CUSTOM_THEMES = [
  {
    id: 'custom-1',
    label: 'Custom 1',
    colors: { bg: '#f3f7f2', surface: '#e2ece0', text: '#16231a', accent: '#2f7d4f' },
  },
  {
    id: 'custom-2',
    label: 'Custom 2',
    colors: { bg: '#fff6ee', surface: '#fbe6d4', text: '#2b1a10', accent: '#d2602a' },
  },
  {
    id: 'custom-3',
    label: 'Custom 3',
    colors: { bg: '#17151f', surface: '#24212f', text: '#ebe7f5', accent: '#a58cf0' },
  },
];

const MAX_LABEL = 24;

/* ── Conversions ─────────────────────────────────────── */

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const isHex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

/** Accepts "#abc", "abc", "#aabbcc" or "aabbcc"; returns "#aabbcc" or null. */
export function normalizeHex(value) {
  const raw = String(value ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${[...raw].map((c) => c + c).join('')}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toLowerCase();
  return null;
}

export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export const rgbToHex = (rgb) =>
  `#${rgb.map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('')}`;

/** h in degrees [0, 360), s and v in [0, 1]. */
export function rgbToHsv([r, g, b]) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const d = max - Math.min(rn, gn, bn);
  let h = 0;
  if (d) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToRgb({ h, s, v }) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return [f(5), f(3), f(1)];
}

export const hexToHsv = (hex) => rgbToHsv(hexToRgb(hex));
export const hsvToHex = (hsv) => rgbToHex(hsvToRgb(hsv));

/* ── Contrast ────────────────────────────────────────── */

const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `weight` of a over b, as color-mix(in srgb, a weight, b) does. */
export function mix(a, b, weight) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((c, i) => c * weight + cb[i] * (1 - weight)));
}

/** Moves `color` toward `toward` in small steps until it clears `min` on every ground. */
function readableOn(color, grounds, toward, min = 4.5) {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const candidate = mix(toward, color, t);
    if (grounds.every((g) => contrast(candidate, g) >= min)) return candidate;
  }
  return toward;
}

/** White or near-black, whichever reads better on `ground`. */
const inkFor = (ground) => (contrast('#ffffff', ground) >= contrast('#111111', ground) ? '#ffffff' : '#111111');

/* ── Deriving a full theme ───────────────────────────── */

export const schemeOf = (bg) => (luminance(bg) < 0.2 ? 'dark' : 'light');

/** Every role themes.css sets, from the four a person picks. */
export function deriveTokens({ bg, surface, text, accent }) {
  const scheme = schemeOf(bg);
  const dark = scheme === 'dark';
  // Light themes use the accent as the week card; dark ones a deep tinted field,
  // matching the built-in themes (see the note at the top of themes.css).
  const pass = dark ? mix(accent, bg, 0.38) : accent;
  const [r, g, b] = hexToRgb(text);
  return {
    scheme,
    '--color-bg': bg,
    '--color-surface': surface,
    '--color-text': text,
    '--color-accent': accent,
    '--color-accent-700': readableOn(accent, [bg, surface], text),
    '--color-on-accent': inkFor(accent),
    '--color-pass': pass,
    '--color-on-pass': inkFor(pass),
    '--color-signal': readableOn(dark ? '#e88f85' : '#b43933', [bg, surface], text),
    '--color-divider': `rgba(${r}, ${g}, ${b}, ${dark ? 0.14 : 0.16})`,
  };
}

/** The readings a person should see while mixing: ink on both grounds, and muted ink. */
export function readability({ bg, surface, text }) {
  const muted = mix(text, bg, 0.7);
  const checks = [
    { label: 'Text on background', ratio: contrast(text, bg) },
    { label: 'Text on cards', ratio: contrast(text, surface) },
    { label: 'Secondary text', ratio: Math.min(contrast(muted, bg), contrast(muted, surface)) },
  ];
  return checks.map((c) => ({ ...c, ok: c.ratio >= 4.5 }));
}

export function customThemeCss(themes) {
  return themes
    .map(({ id, colors }) => {
      const { scheme, ...tokens } = deriveTokens(colors);
      const decls = Object.entries(tokens)
        .map(([name, value]) => `  ${name}: ${value};`)
        .join('\n');
      return `[data-theme='${id}'] {\n  color-scheme: ${scheme};\n${decls}\n}`;
    })
    .join('\n\n');
}

/* ── Storage ─────────────────────────────────────────── */

export const cleanLabel = (label, fallback) => {
  const trimmed = String(label ?? '').trim().slice(0, MAX_LABEL);
  return trimmed || fallback;
};

/** Whatever was stored, merged over the defaults so a bad entry can't break a slot. */
export function sanitizeCustomThemes(stored) {
  const list = Array.isArray(stored) ? stored : [];
  return DEFAULT_CUSTOM_THEMES.map((base) => {
    const saved = list.find((t) => t?.id === base.id);
    if (!saved) return base;
    const colors = {};
    for (const { key } of CUSTOM_ROLES) {
      colors[key] = normalizeHex(saved.colors?.[key]) ?? base.colors[key];
    }
    return { id: base.id, label: cleanLabel(saved.label, base.label), colors };
  });
}

export function readCustomThemes() {
  try {
    return sanitizeCustomThemes(JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY)));
  } catch {
    return DEFAULT_CUSTOM_THEMES;
  }
}

export function writeCustomThemes(themes) {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(themes));
  } catch {
    // Private mode or blocked storage: the edits last for this visit only.
  }
}
