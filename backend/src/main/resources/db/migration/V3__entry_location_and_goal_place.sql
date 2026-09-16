-- Where something happened, recorded alongside what happened.
--
-- The coordinates live on the entry rather than only in `locations` so an
-- entry keeps its place even if the locations history is pruned, and so the
-- week's entries can be mapped without a join on timestamps. `locations`
-- still receives a row for each fix, which is what the Places map reads.
ALTER TABLE behaviors ADD COLUMN latitude   DOUBLE PRECISION;
ALTER TABLE behaviors ADD COLUMN longitude  DOUBLE PRECISION;
ALTER TABLE behaviors ADD COLUMN place_name VARCHAR(255);

-- A goal's usual place. Free text: "the gym on Fifth" is more useful on a
-- card than a pair of coordinates, and entries logged against the goal start
-- from it.
ALTER TABLE goals ADD COLUMN place_name VARCHAR(255);
