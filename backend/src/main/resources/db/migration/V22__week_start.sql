-- The day a person's week starts on: Monday or Sunday. It is the week every
-- count uses, not only the calendar's layout: weekly targets, the dashboard,
-- reports, reminders and shared goals all run from it.
--
-- Monday for every existing account, which is how weeks have always been
-- counted, so nobody's week moves when this ships.
ALTER TABLE users ADD COLUMN week_start VARCHAR(6) NOT NULL DEFAULT 'monday';

ALTER TABLE users ADD CONSTRAINT chk_users_week_start
    CHECK (week_start IN ('monday', 'sunday'));
