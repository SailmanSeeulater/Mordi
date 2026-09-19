import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ensureLastWeekReport, lastWeekStart } from '../lib/autoReview';
import { normaliseReport, reportWeekLabel } from '../pages/reportData';

const seenKey = (iso) => `mordi-review-seen-${iso}`;

function wasSeen(iso) {
  try {
    return localStorage.getItem(seenKey(iso)) === '1';
  } catch {
    return false;
  }
}

/**
 * Last week, reviewed. Appears once a week has ended and been written up
 * (which happens here, automatically, the first time the dashboard opens),
 * until it is opened or dismissed. One line of what happened and a way into
 * the full week, rather than a report someone has to remember to write.
 */
export default function WeekReviewCard({ today, loggedLastWeek }) {
  const iso = lastWeekStart(today);
  const [report, setReport] = useState(null);
  const [hidden, setHidden] = useState(() => wasSeen(iso));

  useEffect(() => {
    if (hidden) return undefined;
    let live = true;
    ensureLastWeekReport(today, loggedLastWeek).then((row) => {
      if (live && row) setReport(normaliseReport(row));
    });
    return () => {
      live = false;
    };
  }, [today, loggedLastWeek, hidden]);

  if (hidden || !report) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(seenKey(iso), '1');
    } catch {
      // It just comes back next visit.
    }
    setHidden(true);
  };

  return (
    <section className="app-panel review-card" aria-labelledby="dash-review-title">
      <div className="review-card__text">
        <h2 className="review-card__title" id="dash-review-title">
          Last week, {reportWeekLabel(report)}
        </h2>
        <p>
          {report.legacy
            ? `${report.logged} entries logged.`
            : `${report.achieved} of ${report.planned} planned days, ${report.percent}%.`}
          {report.goalsTotal != null && ` ${report.goalsOnTrack} of ${report.goalsTotal} goals on target.`}
        </p>
      </div>
      <div className="review-card__actions">
        <Link to={`/reports/${iso}`} className="app-btn app-btn--sm" onClick={dismiss}>
          Open the review
        </Link>
        <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}
