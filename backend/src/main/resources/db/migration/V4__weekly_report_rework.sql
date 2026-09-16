-- Weekly reports, reworked.
--
-- Two changes. First, a report is now keyed to a calendar week (Monday to
-- Sunday, matching the week the dashboard shows), and regenerating it
-- replaces that week's row instead of appending another one. Second, the
-- report measures entries against the targets the goals were given, so it
-- answers "did the week go to plan" rather than only "how many of the things
-- I wrote down did I tick".
--
-- Note on completion_rate: rows written before this migration hold
-- completed/logged. Rows written after hold achieved/planned. Both are
-- percentages; they are not the same question.

ALTER TABLE reports ADD COLUMN planned_entries  INTEGER;
ALTER TABLE reports ADD COLUMN achieved_entries INTEGER;
ALTER TABLE reports ADD COLUMN goals_on_track   INTEGER;
ALTER TABLE reports ADD COLUMN goals_total      INTEGER;

-- Collapse any duplicate weeks that already exist, keeping the newest row.
DELETE FROM reports r
USING reports keep
WHERE r.user_id = keep.user_id
  AND r.week_start = keep.week_start
  AND r.id < keep.id;

ALTER TABLE reports
  ADD CONSTRAINT uq_reports_user_week UNIQUE (user_id, week_start);
