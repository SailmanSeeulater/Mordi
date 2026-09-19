-- Opt-in reminders by Web Push.
--
-- A person may be subscribed from several browsers; each subscription is one
-- row, keyed by the push service's endpoint URL. The reminder itself is one
-- hour of the day in the person's own time zone, and last_reminded_on keeps it
-- to once a day however often the scheduler runs.
ALTER TABLE users ADD COLUMN time_zone VARCHAR(64);
ALTER TABLE users ADD COLUMN reminder_hour SMALLINT
    CONSTRAINT users_reminder_hour_range CHECK (reminder_hour BETWEEN 0 AND 23);
ALTER TABLE users ADD COLUMN last_reminded_on DATE;

CREATE TABLE push_subscriptions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint    VARCHAR(1000) NOT NULL UNIQUE,
    p256dh      VARCHAR(200)  NOT NULL,
    auth        VARCHAR(100)  NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
