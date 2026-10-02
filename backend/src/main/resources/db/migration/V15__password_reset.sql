-- Email addresses compared without regard to case, and one-time links for
-- account actions: password reset now, email verification and account
-- deletion to follow.
--
-- Until now "Ana@example.com" and "ana@example.com" were two accounts, and a
-- sign-in had to match the case used at sign-up. From here the app stores and
-- looks up every address lowercased and trimmed. Existing rows are folded
-- first; if two of them would collide, the migration stops and names the
-- address, so the duplicate is resolved by hand rather than silently merged.
DO $$
DECLARE dup TEXT;
BEGIN
    SELECT lower(trim(email)) INTO dup
    FROM users
    GROUP BY lower(trim(email))
    HAVING count(*) > 1
    LIMIT 1;
    IF dup IS NOT NULL THEN
        RAISE EXCEPTION 'Two accounts share the address % apart from case; merge or delete one before migrating', dup;
    END IF;
END $$;

UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email));

-- The app lowercases on the way in; this refuses any future path that forgets.
CREATE UNIQUE INDEX idx_users_email_lower ON users (lower(email));

-- One-time links. Only a SHA-256 of each token is stored, as for refresh
-- tokens and invites: the raw value lives in the link and nowhere else. A
-- token is good for one purpose until it expires or is used, and issuing a
-- new one retires any still outstanding for the same purpose, so only the
-- latest link works.
CREATE TABLE user_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose     VARCHAR(32)  NOT NULL,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,
    created_at  TIMESTAMP    NOT NULL,
    expires_at  TIMESTAMP    NOT NULL,
    used_at     TIMESTAMP
);
CREATE INDEX idx_user_tokens_user_purpose ON user_tokens(user_id, purpose);
