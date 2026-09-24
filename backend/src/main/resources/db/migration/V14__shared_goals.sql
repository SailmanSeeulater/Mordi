-- Shared goals: several people working on one goal, each logging their own
-- entries against it.
--
-- goal_members lists everyone in a shared goal, the owner included. A goal
-- that was never shared has no rows here at all; the owner's row is added the
-- first time an invite is made. last_read_message_id marks how far each
-- member has read the goal's thread, for unread counts.
CREATE TABLE goal_members (
    id                   BIGSERIAL PRIMARY KEY,
    goal_id              BIGINT      NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id              BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_read_message_id BIGINT      NOT NULL DEFAULT 0,
    CONSTRAINT goal_members_once UNIQUE (goal_id, user_id)
);
CREATE INDEX idx_goal_members_user ON goal_members(user_id);

-- Invite links. Only the SHA-256 of the code is kept, as for refresh tokens:
-- the code itself is shown to the owner once and then exists only in the
-- link they share.
CREATE TABLE goal_invites (
    id          BIGSERIAL PRIMARY KEY,
    goal_id     BIGINT      NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    created_by  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ
);
CREATE INDEX idx_goal_invites_goal ON goal_invites(goal_id);

-- The thread inside a shared goal. Messages exist only between members of
-- the same goal; there is no messaging between arbitrary accounts.
CREATE TABLE goal_messages (
    id          BIGSERIAL PRIMARY KEY,
    goal_id     BIGINT       NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        VARCHAR(500) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_goal_messages_goal ON goal_messages(goal_id, id);
CREATE INDEX idx_goal_messages_user_time ON goal_messages(user_id, created_at);
