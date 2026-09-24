import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { readInviteCode, togetherApi } from '../lib/together';
import { enableModule } from '../lib/modules';
import './together.css';

/**
 * Where an invite link lands: /join#<code>. Says whose goal it is and what
 * joining shares before anything happens; nothing is joined until the person
 * says so.
 */
export default function Join() {
  useDocumentTitle('Join a goal');
  const location = useLocation();
  const navigate = useNavigate();
  const code = readInviteCode(location.hash);

  const [preview, setPreview] = useState(null);
  const [state, setState] = useState(code ? 'loading' : 'invalid'); // loading | ready | invalid | error
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!code) return undefined;
    let live = true;
    togetherApi
      .preview(code)
      .then((res) => {
        if (!live) return;
        setPreview(res.data);
        setState('ready');
      })
      .catch((err) => {
        if (live) setState(err?.response?.status === 404 ? 'invalid' : 'error');
      });
    return () => {
      live = false;
    };
  }, [code]);

  const join = async () => {
    setJoining(true);
    setJoinError('');
    try {
      const res = await togetherApi.accept(code);
      enableModule('together');
      navigate(`/together/${res.data.goalId}`, { replace: true });
    } catch (err) {
      setJoining(false);
      setJoinError(
        err?.response?.status === 409 || err?.response?.status === 404
          ? err.response.data?.error ?? 'This invite can’t be used any more.'
          : 'Couldn’t join. Check your connection and try again.',
      );
    }
  };

  const perWeek = preview?.targetPerWeek === 7 ? 'every day' : `${preview?.targetPerWeek}× a week`;

  return (
    <AppShell title="Join a goal">
      {state === 'loading' && (
        <p className="app-status" role="status">
          Opening the invite&hellip;
        </p>
      )}

      {state === 'invalid' && (
        <section className="onboard app-glass join" aria-labelledby="join-title">
          <h2 className="onboard__title" id="join-title">
            This invite has expired.
          </h2>
          <p className="onboard__body">
            Invite links last a week, and a new one replaces the last. Ask whoever sent it for a fresh link.
          </p>
          <div className="onboard__actions">
            <Link className="app-btn app-btn--quiet" to="/dashboard">
              Go to your dashboard
            </Link>
          </div>
        </section>
      )}

      {state === 'error' && (
        <div className="app-status" role="alert">
          <span>Couldn&rsquo;t open the invite.</span>
          <button type="button" className="app-btn app-btn--quiet" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      )}

      {state === 'ready' && preview && (
        <section className="onboard app-glass join" aria-labelledby="join-title">
          <h2 className="onboard__title" id="join-title">
            {preview.goalTitle}
          </h2>
          <p className="join__facts">
            <span>{preview.ownerName} invited you</span>
            <span aria-hidden="true">&middot;</span>
            <span>{perWeek}</span>
            <span aria-hidden="true">&middot;</span>
            <span>
              {preview.memberCount} {preview.memberCount === 1 ? 'person' : 'people'} so far
            </span>
          </p>

          {preview.alreadyIn ? (
            <>
              <p className="onboard__body">You&rsquo;re already in this goal.</p>
              <div className="onboard__actions">
                <Link className="app-btn" to={`/together/${preview.goalId}`}>
                  Open it
                </Link>
              </div>
            </>
          ) : (
            <>
              <ul className="join__terms">
                <li>You log it yourself, and it shows up on your dashboard like your own goals.</li>
                <li>
                  Everyone in it sees your name and which days you marked it done.{' '}
                  <strong>Never your notes, moods or places.</strong>
                </li>
                <li>There&rsquo;s a thread for the goal. You can leave whenever you like.</li>
              </ul>
              {joinError && (
                <p className="app-form__error" role="alert">
                  {joinError}
                </p>
              )}
              <div className="onboard__actions">
                <button type="button" className="app-btn" onClick={join} disabled={joining}>
                  {joining ? 'Joining…' : 'Join the goal'}
                </button>
                <Link className="app-btn app-btn--ghost" to="/dashboard">
                  Not now
                </Link>
              </div>
            </>
          )}
        </section>
      )}
    </AppShell>
  );
}
