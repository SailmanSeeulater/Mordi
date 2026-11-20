import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { SAVE_ACCOUNT, guestEndsOn, isGuest } from '../lib/guest';
import Modal from './Modal';
import SaveAccountForm from './SaveAccountForm';

/**
 * The line across the top of every page of a guest ("Try it") account: that
 * it is a demo, the day it goes, and the way to keep it. It also owns the
 * save dialog, which anything in the app can open with askToSave, and which
 * opens on its own when the server turns down something a guest may not do.
 *
 * Once saved, the line thanks the person for the rest of the visit, then
 * goes for good.
 */
export default function GuestBanner() {
  const { user } = useAuth();
  const guest = isGuest(user);
  const [dialog, setDialog] = useState(null); // null | { reason }
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!guest) return undefined;
    const open = (e) => setDialog({ reason: e.detail?.reason ?? '' });
    window.addEventListener(SAVE_ACCOUNT, open);
    return () => window.removeEventListener(SAVE_ACCOUNT, open);
  }, [guest]);

  if (justSaved) {
    return (
      <div className="guest-banner guest-banner--saved" role="status">
        <p className="guest-banner__text">
          Saved. This is your account now, and everything you made in the demo is in it.
        </p>
        <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={() => setJustSaved(false)}>
          Done
        </button>
      </div>
    );
  }
  if (!guest) return null;

  const endsOn = guestEndsOn(user);
  return (
    <>
      <div className="guest-banner">
        <p className="guest-banner__text">
          <strong>You&rsquo;re trying Mordi.</strong>{' '}
          {endsOn ? <>This demo is deleted on {endsOn}.</> : <>This demo is deleted after a week.</>}{' '}
          Save it to keep everything.
        </p>
        <button type="button" className="app-btn app-btn--sm" onClick={() => setDialog({ reason: '' })}>
          Save my account
        </button>
      </div>

      {dialog && (
        <Modal title="Save your account" onClose={() => setDialog(null)}>
          <p className="guest-dialog__lede">
            {dialog.reason ? `${dialog.reason} ` : ''}
            It&rsquo;s free. Your goals, entries, to-dos and notes from the demo all stay.
          </p>
          <SaveAccountForm
            onSaved={() => {
              setDialog(null);
              setJustSaved(true);
            }}
          />
        </Modal>
      )}
    </>
  );
}
