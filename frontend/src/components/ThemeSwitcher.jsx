import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '../context/useTheme';
import { THEMES } from '../context/theme-context-value';

/**
 * The color button. Pressing it advances to the next combination; the caret
 * opens the full set. Each swatch carries its own data-theme, so it paints
 * itself in the colors it applies — no duplicated color values in JS.
 */
export default function ThemeSwitcher({ align = 'end' }) {
  const { theme, setTheme, cycleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuId = useId();

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="theme-switch" ref={wrapRef}>
      <button
        type="button"
        className="theme-switch__cycle"
        onClick={cycleTheme}
        title="Next color combination"
      >
        <span className="theme-switch__chip" aria-hidden="true" />
        <span className="theme-switch__name">{current.label}</span>
        <span className="app-sr">{' — tap for the next color combination'}</span>
      </button>
      <button
        type="button"
        className="theme-switch__more"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? menuId : undefined}
        aria-label="Choose a color combination"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" focusable="false">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className={`theme-switch__menu theme-switch__menu--${align}`}
          id={menuId}
          role="group"
          aria-label="Color combinations"
        >
          <p className="theme-switch__menu-title">Colors</p>
          <div className="theme-switch__grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="theme-swatch"
                aria-pressed={t.id === theme}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
              >
                <span className="theme-swatch__face" data-theme={t.id} aria-hidden="true">
                  <span className="theme-swatch__blob" />
                </span>
                <span className="theme-swatch__label">{t.label}</span>
                <span className="app-sr">{` — ${t.scheme} colors`}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
