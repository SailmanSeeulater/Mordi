-- Finished to-dos become part of the record: they show in Lately and count
-- in the weekly report, so they need a day and a time of their own, and
-- tidying the list can no longer delete them.
--
-- completed_at becomes an absolute instant, as logged_at did for entries in
-- V12: written in server-local time without a zone, it could never say what
-- time of day something was finished. Existing values are read as UTC, the
-- zone the production container runs in.
ALTER TABLE todos ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC';

-- The person's own calendar day it was finished on, from their browser, the
-- way an entry's log_date is. Older rows take the UTC date, which is the best
-- the record can say for them.
ALTER TABLE todos ADD COLUMN completed_on DATE;
UPDATE todos SET completed_on = (completed_at AT TIME ZONE 'UTC')::date WHERE done AND completed_at IS NOT NULL;

-- "Clear done" now takes finished to-dos off the list without erasing them.
-- Set when cleared; such rows are history only. Deleting one outright still
-- removes it everywhere.
ALTER TABLE todos ADD COLUMN cleared_at TIMESTAMPTZ;

CREATE INDEX idx_todos_user_completed_on ON todos(user_id, completed_on) WHERE done;
