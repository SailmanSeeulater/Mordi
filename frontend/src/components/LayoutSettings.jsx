import { MODULES, isOn, setMode, setModule, useModules } from '../lib/modules';

const MODES = [
  { id: 'focused', label: 'Focused' },
  { id: 'everything', label: 'Everything' },
];

/**
 * How much of Mordi shows. Focused starts with the goals and the week and
 * lets the rest be added; Everything is every section and every dashboard
 * block. Each module can also be switched on its own.
 */
export default function LayoutSettings() {
  const prefs = useModules();
  const mode = prefs?.mode ?? 'everything';

  return (
    <section className="app-panel" aria-labelledby="set-layout">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="set-layout">
          What Mordi shows
        </h2>
      </div>
      <div className="settings__layout-mode">
        <div className="app-segments" role="group" aria-labelledby="set-layout">
          <span
            className="app-segments__thumb"
            style={{ '--n': MODES.length, '--i': MODES.findIndex((m) => m.id === mode) }}
            aria-hidden="true"
          />
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className="app-segment"
              aria-pressed={m.id === mode}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="settings__note">
        {mode === 'focused'
          ? 'Your goals and your week, and only what you switch on below. Some turn themselves on when there is something to show: Together when you share a goal, History when you archive one, Activity after two weeks of logging.'
          : 'Every section and every block on the dashboard. Switch any of them off below to go back to a quieter page.'}
      </p>
      <ul className="settings__modules">
        {MODULES.map((m) => {
          const on = isOn(prefs, m.id);
          return (
            <li key={m.id} className="settings__module">
              <span className="settings__module-text">
                <span className="settings__module-label" id={`mod-${m.id}`}>
                  {m.label}
                </span>
                <span className="settings__module-blurb">{m.blurb}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`mod-${m.id}`}
                className="app-switch"
                onClick={() => setModule(m.id, !on)}
              >
                <span className="app-switch__knob" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
