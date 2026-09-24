import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import { initials, inviteUrl, togetherApi } from '../lib/together';
import { enableModule } from '../lib/modules';
import '../pages/together.css';

const expiry = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * Sharing a goal you own: an invite link, and who is in. The link is shown
 * once, when made; only its hash is kept, so a new one replaces the last.
 */
export default function ShareGoalDialog({ goal, onClose, onChanged }) {
  const [people, setPeople] = useState(null);
  const [max, setMax] = useState(8);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState('');

  const loadPeople = useCallback(async () => {
    try {
      const res = await togetherApi.week(goal.id);
      setPeople(res.data.members);
      setMax(res.data.maxMembers);
    } catch {
      setError('Couldn’t load who’s in this goal.');
    }
  }, [goal.id]);

  useEffect(() => {
    // Loading on open is the point of the effect: fetch, then set state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPeople();
  }, [loadPeople]);

  const createLink = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await togetherApi.createInvite(goal.id);
      setLink({ url: inviteUrl(res.data.code), expiresAt: res.data.expiresAt });
      enableModule('together');
      setCopied(false);
    } catch {
      setError('Couldn’t make a link. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const stopLink = async () => {
    setBusy(true);
    try {
      await togetherApi.revokeInvites(goal.id);
      setLink(null);
    } catch {
      setError('Couldn’t turn the link off. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      // No clipboard permission: the field is selected so it can be copied by hand.
      document.getElementById('share-link')?.select();
    }
  };

  const remove = async (person) => {
    setBusy(true);
    try {
      await togetherApi.removeMember(goal.id, person.id);
      setConfirming(null);
      await loadPeople();
      onChanged?.();
    } catch {
      setError(`Couldn’t remove ${person.name}. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  const full = people && people.length >= max;

  return (
    <Modal title={`Share “${goal.title}”`} onClose={onClose}>
      <div className="share">
        <p className="share__lede">
          People you invite log this goal themselves, and you see each other&rsquo;s week. They see your name and
          which days you marked it done: <strong>never your notes, moods or places.</strong>
        </p>

        <section className="share__block" aria-labelledby="share-link-title">
          <h3 className="share__title" id="share-link-title">
            Invite link
          </h3>
          {link ? (
            <>
              <div className="app-field share__link">
                <div className="app-inputrow">
                  <input
                    id="share-link"
                    value={link.url}
                    readOnly
                    aria-label="Invite link"
                    onFocus={(e) => e.target.select()}
                  />
                  <button type="button" className="app-btn app-btn--sm" onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <p className="share__note">
                Anyone with this link can join until {expiry.format(new Date(link.expiresAt))}. It&rsquo;s shown only
                now, so copy it before you close this.{' '}
                <button type="button" className="app-linkbtn" onClick={stopLink} disabled={busy}>
                  Turn it off
                </button>
              </p>
            </>
          ) : (
            <>
              <p className="share__note">
                A link lasts a week. Making a new one turns off the last, so a link that went further than you meant is
                closed by making another.
              </p>
              <button type="button" className="app-btn" onClick={createLink} disabled={busy || full}>
                {busy ? 'Making a link…' : full ? `Full (${max} people)` : 'Make an invite link'}
              </button>
            </>
          )}
        </section>

        <section className="share__block" aria-labelledby="share-people-title">
          <h3 className="share__title" id="share-people-title">
            People {people && <span className="share__count">{people.length}/{max}</span>}
          </h3>
          {!people && !error && <p className="share__note">Loading&hellip;</p>}
          {people && (
            <ul className="share__people">
              {people.map((person) => (
                <li key={person.id} className="share__person">
                  <span className="together-avatar" aria-hidden="true">
                    {initials(person.name)}
                  </span>
                  <span className="share__name">
                    {person.name}
                    {person.you && <span className="share__tag">You</span>}
                    {person.owner && !person.you && <span className="share__tag">Owner</span>}
                  </span>
                  {!person.you &&
                    (confirming === person.id ? (
                      <span className="share__confirm">
                        <button
                          type="button"
                          className="app-btn app-btn--sm"
                          onClick={() => remove(person)}
                          disabled={busy}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          className="app-btn app-btn--ghost app-btn--sm"
                          onClick={() => setConfirming(null)}
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="app-linkbtn"
                        onClick={() => setConfirming(person.id)}
                        aria-label={`Remove ${person.name}`}
                      >
                        Remove
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && (
          <p className="app-form__error" role="alert">
            {error}
          </p>
        )}

        {people && people.length > 1 && (
          <div className="app-form__actions">
            <Link className="app-btn app-btn--quiet" to={`/together/${goal.id}`}>
              Open the thread
            </Link>
          </div>
        )}
      </div>
    </Modal>
  );
}
