-- How long a timed entry took, in seconds. Null for an ordinary entry.
--
-- A session from the time logger is saved as an entry like any other, so it
-- appears in the feed, the activity grid and the week without a second
-- source of data to merge. This column is the only thing that distinguishes
-- it.
ALTER TABLE behaviors ADD COLUMN duration_seconds INTEGER;

ALTER TABLE behaviors
  ADD CONSTRAINT chk_behaviors_duration_non_negative
  CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
