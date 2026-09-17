-- Refresh tokens: what keeps someone signed in past the access token's short
-- life.
--
-- Only a SHA-256 of each token is stored. The raw value lives in an httpOnly
-- cookie on the person's device and nowhere else, so a copy of this table is
-- not a set of working sessions.
--
-- Tokens rotate on every use. Every token descended from one sign-in shares a
-- family_id, so if a token that has already been rotated is presented again —
-- which only happens when someone other than the owner has a copy — the whole
-- family can be revoked at once.
CREATE TABLE refresh_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,
    family_id   UUID         NOT NULL,
    expires_at  TIMESTAMP    NOT NULL,
    created_at  TIMESTAMP    NOT NULL,
    revoked_at  TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id   ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);
