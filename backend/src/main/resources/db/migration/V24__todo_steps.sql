-- A to-do can have a few steps under it, each with its own tick: a short
-- list read and written whole with the to-do, so it lives beside it as
-- JSON, [{"id": "...", "text": "...", "done": false}], in order.
ALTER TABLE todos ADD COLUMN steps JSONB NOT NULL DEFAULT '[]';
