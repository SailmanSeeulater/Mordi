-- The moment an entry was logged, as an absolute instant.
--
-- created_at is a TIMESTAMP without a zone, written in the server's local
-- time, so the browser could never say what time of day something happened.
-- logged_at is TIMESTAMPTZ: the browser renders it in the person's own zone.
--
-- Existing rows are backfilled from created_at read as UTC, which is the zone
-- the production container runs in. A timer session carries its own start
-- instead, so "when" means when the work began.
ALTER TABLE behaviors ADD COLUMN logged_at TIMESTAMPTZ;
UPDATE behaviors SET logged_at = created_at AT TIME ZONE 'UTC' WHERE created_at IS NOT NULL;
CREATE INDEX idx_behaviors_user_place ON behaviors(user_id, place_name) WHERE place_name IS NOT NULL;
