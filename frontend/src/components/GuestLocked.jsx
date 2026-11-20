import { askToSave } from '../lib/guest';

/**
 * Stands in for a feature a guest ("Try it") account cannot use: says what
 * it is waiting for and offers the one step that unlocks it. The server
 * refuses these too (GuestFilter); this just says so before anyone tries.
 */
export default function GuestLocked({ what, onClose }) {
  return (
    <div className="guest-locked">
      <p className="guest-locked__text">
        {what} needs a saved account. Saving is free, and everything you&rsquo;ve made in the demo stays.
      </p>
      <button
        type="button"
        className="app-btn app-btn--sm"
        onClick={() => {
          onClose?.();
          askToSave();
        }}
      >
        Save my account
      </button>
    </div>
  );
}
