-- Whether a planned block actually happened.
--
-- 'done' links the entry that was logged for it, so the week report can say
-- how many planned blocks turned into logged ones, and undoing the answer can
-- remove exactly that entry. 'skipped' is an explicit no. NULL means not yet
-- answered. Deleting the entry leaves the event, unanswered again.
ALTER TABLE plan_events ADD COLUMN outcome VARCHAR(10)
    CONSTRAINT plan_events_outcome_known CHECK (outcome IN ('done', 'skipped'));
ALTER TABLE plan_events ADD COLUMN behavior_id BIGINT
    REFERENCES behaviors(id) ON DELETE SET NULL;
