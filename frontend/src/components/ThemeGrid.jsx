import { useTheme } from '../context/useTheme';

const GROUPS = [
  { key: 'light', label: 'Light', has: (t) => !t.custom && t.scheme === 'light' },
  { key: 'dark', label: 'Dark', has: (t) => !t.custom && t.scheme === 'dark' },
  { key: 'custom', label: 'Your themes', has: (t) => t.custom },
];

/**
 * Every color combination, grouped light, dark, then the person's own. Shared by the color menu
 * in the top bar and the Appearance panel in Settings, so the two can never
 * disagree about order or grouping.
 *
 * Each face carries its own data-theme, so it paints itself in the colors it
 * applies: the ground, and the accent on it. No color values are duplicated
 * in JS.
 */
export default function ThemeGrid({ theme, onPick, idPrefix }) {
  const { allThemes } = useTheme();
  return (
    <div className="theme-grid">
      {GROUPS.map((group) => {
        const headingId = `${idPrefix}-${group.key}`;
        return (
          <div className="theme-grid__group" key={group.key} role="group" aria-labelledby={headingId}>
            <p className="theme-grid__heading" id={headingId}>
              {group.label}
            </p>
            <div className="theme-grid__swatches">
              {allThemes.filter(group.has).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="theme-swatch"
                  aria-pressed={t.id === theme}
                  onClick={() => onPick(t.id)}
                >
                  <span className="theme-swatch__face" data-theme={t.id} aria-hidden="true">
                    <span className="theme-swatch__blob" />
                  </span>
                  <span className="theme-swatch__label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
