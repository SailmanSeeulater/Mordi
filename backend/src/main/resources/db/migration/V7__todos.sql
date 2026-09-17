-- To-dos: one-line items with no description, kept beside the entry feed.
--
-- Deliberately separate from goals and entries. A to-do has no weekly target
-- and is not logged against a day; it is done once and then cleared.
CREATE TABLE todos (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text         VARCHAR(200) NOT NULL,
    done         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL,
    completed_at TIMESTAMP
);

CREATE INDEX idx_todos_user_id ON todos(user_id);
