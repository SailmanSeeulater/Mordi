-- Removing a to-do now keeps it, for History: the list, Lately and the
-- reports leave it out, and History shows it as removed beside the ones that
-- were done. Deleting it from History is what erases it.
ALTER TABLE todos ADD COLUMN removed_at TIMESTAMPTZ;

-- History reads a person's done and removed to-dos, newest first.
CREATE INDEX idx_todos_user_history ON todos(user_id, COALESCE(removed_at, completed_at) DESC)
    WHERE done OR removed_at IS NOT NULL;
