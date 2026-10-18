import { formatRange, parseLocal } from '../lib/planner';
import FeedMark from './FeedMark';

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/**
 * An event copied from a connected Google Calendar, read-only: what, when,
 * where and its notes, and where it came from. Changing it happens in
 * Google; the next sync brings the change here.
 */
export default function FeedEventDetail({ event, feedName, onClose }) {
  const start = parseLocal(event.startsAt);
  const lastDay = event.allDay ? new Date(parseLocal(event.endsAt).getTime() - 1) : parseLocal(event.endsAt);
  const days =
    event.allDay && lastDay.toDateString() !== start.toDateString()
      ? `${dayFormat.format(start)} to ${dayFormat.format(lastDay)}`
      : dayFormat.format(start);

  return (
    <div className={`app-form feed-event ev--${event.color ?? 'sky'}`}>
      <dl className="feed-event__facts">
        <div>
          <dt>When</dt>
          <dd>
            {days}
            {!event.allDay && <> &middot; {formatRange(event)}</>}
            {event.allDay && <> &middot; All day</>}
          </dd>
        </div>
        {event.placeName && (
          <div>
            <dt>Place</dt>
            <dd>{event.placeName}</dd>
          </div>
        )}
        {event.notes && (
          <div>
            <dt>Notes</dt>
            <dd className="feed-event__notes">{event.notes}</dd>
          </div>
        )}
      </dl>

      <p className="feed-event__source">
        <FeedMark size={13} />
        <span>
          From Google Calendar{feedName ? ` · ${feedName}` : ''}
        </span>
      </p>
      <p className="app-field__hint">Change it in Google Calendar.</p>

      <div className="app-form__actions">
        <button type="button" className="app-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
