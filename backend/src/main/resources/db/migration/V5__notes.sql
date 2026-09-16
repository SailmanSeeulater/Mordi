-- Notes: short freeform text a user keeps alongside their goals.
--
-- Capped at five per user. The cap is enforced in NoteService rather than by a
-- constraint, because a check constraint on a count would need a trigger and
-- the service is where the error message belongs.
CREATE TABLE notes (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(120),
    body       TEXT         NOT NULL,
    pinned     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Every read is "the notes belonging to me, newest edit first".
CREATE INDEX idx_notes_user_id ON notes(user_id);
