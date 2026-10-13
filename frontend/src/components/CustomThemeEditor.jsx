import { useState } from 'react';
import { useTheme } from '../context/useTheme';
import { CUSTOM_ROLES, readability } from '../lib/customTheme';
import ColorWheel from './ColorWheel';

/**
 * Three themes a person mixes themselves. Each is four colors — background,
 * cards, text, accent — and the rest of the theme is derived from them
 * (see lib/customTheme.js). Edits apply live, and if the slot being edited is
 * the active theme, the whole app follows along.
 */
export default function CustomThemeEditor() {
  const { theme, setTheme, customThemes, updateCustomTheme, resetCustomTheme } = useTheme();
  const [slotId, setSlotId] = useState(() =>
    customThemes.some((t) => t.id === theme) ? theme : customThemes[0]?.id,
  );
  const [role, setRole] = useState(CUSTOM_ROLES[0].key);

  const slot = customThemes.find((t) => t.id === slotId) ?? customThemes[0];
  if (!slot) return null;

  const active = theme === slot.id;
  const roleLabel = CUSTOM_ROLES.find((r) => r.key === role).label;
  const checks = readability(slot.colors);

  return (
    <section className="app-panel" aria-labelledby="set-custom">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="set-custom">
          Your themes
        </h2>
        <div className="app-panel__spacer" />
        {active && <span className="app-panel__meta">In use</span>}
      </div>

      <div className="ctheme">
        <div className="app-segments" role="group" aria-label="Custom theme to edit">
          <span
            className="app-segments__thumb"
            style={{ '--n': customThemes.length, '--i': customThemes.findIndex((t) => t.id === slot.id) }}
            aria-hidden="true"
          />
          {customThemes.map((t) => (
            <button
              key={t.id}
              type="button"
              className="app-segment ctheme__slot"
              aria-pressed={t.id === slot.id}
              onClick={() => setSlotId(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="app-field ctheme__name">
          <label htmlFor="ctheme-name">Name</label>
          <div className="app-inputrow">
            <NameInput
              key={slot.id}
              value={slot.label}
              onCommit={(label) => updateCustomTheme(slot.id, { label })}
            />
            <button
              type="button"
              className="app-btn app-btn--sm"
              disabled={active}
              onClick={() => setTheme(slot.id)}
            >
              {active ? 'In use' : 'Use this theme'}
            </button>
          </div>
        </div>

        <div className="ctheme__roles" role="group" aria-label="Color to change">
          {CUSTOM_ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              className="ctheme__role"
              aria-pressed={r.key === role}
              onClick={() => setRole(r.key)}
            >
              <span className="ctheme__dot" style={{ background: slot.colors[r.key] }} aria-hidden="true" />
              <span className="ctheme__role-text">
                <span className="ctheme__role-label">{r.label}</span>
                <span className="ctheme__role-hex">{slot.colors[r.key]}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="ctheme__work">
          <ColorWheel
            label={roleLabel}
            value={slot.colors[role]}
            onChange={(hex) => updateCustomTheme(slot.id, { colors: { [role]: hex } })}
          />

          <div className="ctheme__side">
            {/* Painted by the slot's own [data-theme] block, so it shows exactly
                what the app will. */}
            <div className="ctheme__preview" data-theme={slot.id} aria-label={`Preview of ${slot.label}`} role="img">
              <div className="ctheme__pv-card">
                <span className="ctheme__pv-title">Morning run</span>
                <span className="ctheme__pv-muted">3 of 5 this week</span>
                <span className="ctheme__pv-link">View history</span>
                <span className="ctheme__pv-btn">Log it</span>
              </div>
              <div className="ctheme__pv-pass">
                <span>This week</span>
                <strong>12</strong>
              </div>
            </div>

            <ul className="ctheme__checks" aria-label="Readability">
              {checks.map((c) => (
                <li key={c.label} className={'ctheme__check' + (c.ok ? '' : ' ctheme__check--low')}>
                  <span>{c.label}</span>
                  <span className="ctheme__ratio">
                    {c.ratio.toFixed(1)}:1 {c.ok ? '' : '— hard to read'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="settings__note">
        Pick a color to change, then drag on the wheel or type a hex or RGB value. Links, buttons and
        error text are adjusted automatically so they stay readable. Saved in this browser only.
      </p>
      <div className="settings__actions">
        <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={() => resetCustomTheme(slot.id)}>
          Reset {slot.label}
        </button>
      </div>
    </section>
  );
}

function NameInput({ value, onCommit }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // Renamed from outside (a reset): show it, unless it is just what is being typed.
  if (value !== seen) {
    setSeen(value);
    if (draft.trim() !== value) setDraft(value);
  }
  return (
    <input
      id="ctheme-name"
      type="text"
      maxLength={24}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim()) onCommit(e.target.value);
      }}
      onBlur={() => setDraft(value)}
    />
  );
}
