import { Link } from 'react-router-dom';
import { MODULES, isOn, setMode, setModule } from '../lib/modules';

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" focusable="false">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * The rest of the dashboard, offered rather than imposed. A new account sees
 * its goals and its week; everything else is one tap away here, and each
 * addition stays switchable in Settings. Only what is not on yet is listed,
 * and the whole thing goes once there is nothing left to add.
 */
export default function AddToPage({ prefs }) {
  const offered = MODULES.filter((m) => m.block && !isOn(prefs, m.id));
  if (offered.length === 0) return null;

  return (
    <section className="app-panel addmore" aria-labelledby="addmore-title">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="addmore-title">
          Add to this page
        </h2>
        <div className="app-panel__spacer" />
        <button type="button" className="app-linkbtn" onClick={() => setMode('everything')}>
          Show everything
        </button>
      </div>
      <p className="addmore__lede">
        You start with your goals and your week. Add the rest when you want it; each one can be switched off again in{' '}
        <Link to="/settings">Settings</Link>.
      </p>
      <ul className="addmore__list">
        {offered.map((m) => (
          <li key={m.id}>
            <button type="button" className="addmore__item" onClick={() => setModule(m.id, true)}>
              <span className="addmore__plus" aria-hidden="true">
                <IconPlus />
              </span>
              <span className="addmore__text">
                <span className="addmore__label">{m.label}</span>
                <span className="addmore__blurb">{m.blurb}</span>
              </span>
              <span className="app-sr">. Add to this page</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
