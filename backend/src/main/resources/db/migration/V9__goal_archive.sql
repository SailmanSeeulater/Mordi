-- Archiving: a goal someone has finished with, kept with its history.
--
-- Distinct from deleting, which sets active = false and hides the goal
-- everywhere. An archived goal stays active (its entries still resolve to it)
-- but drops off the dashboard and moves to the History page, where it can be
-- restored. NULL means current.
ALTER TABLE goals ADD COLUMN archived_at TIMESTAMP;

-- The dashboard reads "my current goals" and History reads "my archived
-- goals, newest first"; both start from the owner.
CREATE INDEX idx_goals_user_archived ON goals(user_id, archived_at);
