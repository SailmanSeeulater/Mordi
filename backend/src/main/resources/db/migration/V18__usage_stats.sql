-- Counting how many people use Mordi, and how often, without keeping a record
-- of who did what or when.
--
-- users.last_active_on is the date, in UTC, of the last day the person used
-- the app: never a time of day, and overwritten rather than appended to, so
-- the table cannot be read as a history of anyone's visits. Null for an
-- account that has not been seen since this was added.
ALTER TABLE users ADD COLUMN last_active_on DATE;

-- One row a day, written by the nightly snapshot. Counts only: there is no
-- user id anywhere in it, so it can be kept and shown without being able to
-- say who any of the people were.
CREATE TABLE daily_stats (
    day                  DATE      PRIMARY KEY,
    total_users          INT       NOT NULL,
    new_users            INT       NOT NULL,
    active_users         INT       NOT NULL,
    weekly_active_users  INT       NOT NULL,
    monthly_active_users INT       NOT NULL,
    entries_logged       INT       NOT NULL,
    todos_done           INT       NOT NULL,
    goals_created        INT       NOT NULL,
    cohort_size          INT       NOT NULL,
    cohort_retained      INT       NOT NULL,
    created_at           TIMESTAMP NOT NULL
);
