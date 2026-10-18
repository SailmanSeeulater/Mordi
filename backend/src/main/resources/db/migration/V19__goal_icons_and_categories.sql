-- Every goal shows an icon, and people can make categories of their own.
--
-- goals.icon is a key into the frontend's drawn icon set (the same keys as
-- Icons.KEYS in the backend). Null means "use the category's icon", and a goal
-- with no category either shows the thumbtack.
ALTER TABLE goals ADD COLUMN icon VARCHAR(32);

-- A person's own categories, beside the four built in. A goal still keeps its
-- category as a string: a built-in key ("fitness") or "custom:<id>" for one of
-- these. goals.category is VARCHAR(255) since V1, which "custom:" and any
-- BIGINT fit in, so it is left as it is.
--
-- Capped at 20 per person in CategoryService, for the same reason notes are
-- capped there: that is where the message the person reads belongs.
CREATE TABLE categories (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(40)  NOT NULL,
    icon       VARCHAR(32)  NOT NULL,
    created_at TIMESTAMP    NOT NULL
);

-- One "Reading" per person, whatever its case. Also the index every read uses,
-- since each one starts from the person.
CREATE UNIQUE INDEX uq_categories_user_name ON categories (user_id, lower(name));
