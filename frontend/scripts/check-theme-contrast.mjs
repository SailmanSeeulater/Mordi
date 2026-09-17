// Verifies every theme in src/themes.css meets WCAG AA.
// Run: node scripts/check-theme-contrast.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'src', 'themes.css'), 'utf8');

const srgb = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  }
  const rgba = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => parseFloat(p.trim()));
    return parts.slice(0, 3).concat(parts.length > 3 ? [parts[3]] : []);
  }
  throw new Error(`Unsupported color: ${value}`);
}

const over = ([r, g, b, a = 1], bg) =>
  a === 1 ? [r, g, b] : [r, g, b].map((c, i) => Math.round(c * a + bg[i] * (1 - a)));

const luminance = ([r, g, b]) =>
  0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const themes = [];
for (const block of css.matchAll(/\[data-theme='([\w-]+)'\]\s*\{([^}]+)\}/g)) {
  const tokens = {};
  for (const decl of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[decl[1]] = decl[2].trim();
  }
  themes.push({ name: block[1], scheme: block[2].match(/color-scheme:\s*(\w+)/)?.[1], tokens });
}

// [label, foreground token, background token, minimum ratio]
const CHECKS = [
  ['text on ground', '--color-text', '--color-bg', 4.5],
  ['text on surface', '--color-text', '--color-surface', 4.5],
  ['muted text on ground', 'muted', '--color-bg', 4.5],
  ['muted text on surface', 'muted', '--color-surface', 4.5],
  ['accent text on ground', '--color-accent-700', '--color-bg', 4.5],
  ['accent text on surface', '--color-accent-700', '--color-surface', 4.5],
  ['signal on ground', '--color-signal', '--color-bg', 4.5],
  ['signal on surface', '--color-signal', '--color-surface', 4.5],
  ['on-accent on accent', '--color-on-accent', '--color-accent', 4.5],
  ['on-pass on pass', '--color-on-pass', '--color-pass', 4.5],
  // Day-chip outlines on the week card are decoration, so a low floor applies;
  // their text sits on the raw pass field, covered above.
  ['chip outline on pass', 'chip', '--color-pass', 1.3],
  // Non-text: an accent fill has to be discernible against the ground.
  ['accent fill vs ground', '--color-accent', '--color-bg', 3],
  ['divider vs ground', '--color-divider', '--color-bg', 1.35],
];

let failures = 0;
const rows = [];

for (const theme of themes) {
  const bg = parseColor(theme.tokens['--color-bg']);
  const resolve = (token) => {
    if (token === 'chip') {
      // The chip outline: 32% of the on-pass ink over the pass field.
      const pass = parseColor(theme.tokens['--color-pass']);
      const ink = parseColor(theme.tokens['--color-on-pass']);
      return pass.map((c, i) => Math.round(ink[i] * 0.32 + c * 0.68));
    }
    if (token === 'muted') {
      // Mirrors --color-text-muted: 70% text mixed with the ground.
      const text = parseColor(theme.tokens['--color-text']);
      return text.map((c, i) => Math.round(c * 0.7 + bg[i] * 0.3));
    }
    return parseColor(theme.tokens[token]);
  };

  for (const [label, fgToken, bgToken, min] of CHECKS) {
    const backdrop = over(parseColor(theme.tokens[bgToken]), bg);
    const ratio = contrast(over(resolve(fgToken), backdrop), backdrop);
    const pass = ratio >= min;
    if (!pass) failures += 1;
    rows.push(
      `${pass ? 'ok  ' : 'FAIL'} ${theme.name.padEnd(9)} ${label.padEnd(22)} ${ratio.toFixed(2)} (min ${min})`,
    );
  }
}

const light = themes.filter((t) => t.scheme === 'light').length;
console.log(rows.filter((r) => r.startsWith('FAIL')).join('\n') || 'All contrast checks pass.');
console.log(`\n${themes.length} themes (${light} light, ${themes.length - light} dark), ${rows.length} checks, ${failures} failing.`);

if (themes.length !== 25) {
  console.error(`Expected 25 themes, found ${themes.length}.`);
  process.exit(1);
}
process.exit(failures === 0 ? 0 : 1);
