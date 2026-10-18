-- Google Calendars connected by their secret iCal address, read one way:
-- Google to Mordi, never back.
--
-- The address grants read access to the person's whole calendar, so it is
-- kept like a password: url_ciphertext is AES-256-GCM under MORDI_FEED_KEY
-- (FeedCrypto), and url_hash, the SHA-256 of the normalised address, exists
-- only so the same calendar cannot be connected twice. Neither is ever sent
-- back to the browser.
--
-- last_synced_at is UTC, unlike the other timestamps, because the browser
-- compares it with its own clock to decide whether a refresh is due.
-- last_error is the short sentence the person reads, or null after a sync
-- that worked.
CREATE TABLE calendar_feeds (
    id             BIGSERIAL    PRIMARY KEY,
    user_id        BIGINT       NOT NULL,
    name           VARCHAR(60)  NOT NULL,
    color          VARCHAR(16),
    url_ciphertext TEXT         NOT NULL,
    url_hash       CHAR(64)     NOT NULL,
    last_synced_at TIMESTAMP,
    last_error     VARCHAR(200),
    event_count    INT          NOT NULL DEFAULT 0,
    created_at     TIMESTAMP    NOT NULL,
    CONSTRAINT calendar_feeds_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- One connection per calendar per person. Also the index every read uses,
-- since each one starts from the person.
CREATE UNIQUE INDEX uq_calendar_feeds_user_url ON calendar_feeds (user_id, url_hash);

-- An event copied from a feed points at it, so disconnecting the feed (or
-- deleting the account, which cascades to the feed) takes its copies too.
-- Null for everything planned in Mordi itself, which stays editable.
--
-- external_key names the occurrence inside its feed: the event's UID, plus
-- the start it was scheduled for when it repeats (RECURRENCE-ID for a moved
-- one), so each occurrence of a weekly meeting is its own row and a sync can
-- update it in place.
ALTER TABLE plan_events ADD COLUMN feed_id BIGINT;
ALTER TABLE plan_events ADD COLUMN external_key VARCHAR(255);
ALTER TABLE plan_events ADD CONSTRAINT plan_events_feed_id_fkey
    FOREIGN KEY (feed_id) REFERENCES calendar_feeds(id) ON DELETE CASCADE;
ALTER TABLE plan_events ADD CONSTRAINT chk_plan_events_feed_key
    CHECK (feed_id IS NULL OR external_key IS NOT NULL);

CREATE UNIQUE INDEX uq_plan_events_feed_key ON plan_events (feed_id, external_key)
    WHERE feed_id IS NOT NULL;
