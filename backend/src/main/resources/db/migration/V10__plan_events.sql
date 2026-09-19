-- The calendar: things a person has planned, as opposed to entries, which are
-- things they did.
--
-- Times are local wall-clock times (TIMESTAMP, not TIMESTAMPTZ), the same way
-- log_date is a local date: "gym at 7am" means 7am wherever the person is.
-- An all-day event runs from midnight of its first day to midnight after its
-- last, so every event, timed or not, is one half-open [starts_at, ends_at).
CREATE TABLE plan_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(120)  NOT NULL,
    notes       VARCHAR(1000),
    starts_at   TIMESTAMP     NOT NULL,
    ends_at     TIMESTAMP     NOT NULL,
    all_day     BOOLEAN       NOT NULL DEFAULT FALSE,
    color       VARCHAR(16),
    place_name  VARCHAR(255),
    created_at  TIMESTAMP,
    updated_at  TIMESTAMP,
    CONSTRAINT plan_events_ends_after_start CHECK (ends_at > starts_at)
);

-- Every read is "my events overlapping this week".
CREATE INDEX idx_plan_events_user_starts ON plan_events(user_id, starts_at);
