-- "Try it" accounts: made without an email or password, deleted on their
-- own after a week unless the person saves them. guest_until is when it
-- goes; null for every ordinary account, and set back to null when a guest
-- saves theirs.
ALTER TABLE users ADD COLUMN guest_until TIMESTAMP;
CREATE INDEX idx_users_guest_until ON users (guest_until) WHERE guest_until IS NOT NULL;
