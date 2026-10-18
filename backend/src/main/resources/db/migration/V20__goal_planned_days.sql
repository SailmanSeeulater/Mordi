-- A goal can be planned for particular weekdays: a 3x-a-week run on Monday,
-- Wednesday and Friday. The days repeat every week.
--
-- A 7-bit mask in ISO order, independent of the calendar's week-start
-- preference: bit 0 is Monday, bit 1 Tuesday, ... bit 6 Sunday. Null means
-- no planned days (any day counts, as before); GoalService never stores 0.
-- When it is set, target_per_week is the number of days in it: GoalService
-- sets the one from the other, so the two cannot disagree.
ALTER TABLE goals ADD COLUMN planned_days SMALLINT;

ALTER TABLE goals ADD CONSTRAINT chk_goals_planned_days
    CHECK (planned_days IS NULL OR planned_days BETWEEN 1 AND 127);
