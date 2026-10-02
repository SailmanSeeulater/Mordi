-- Deleting an account deletes what is in it.
--
-- Tables added since the baseline already cascade from users. These four came
-- from Hibernate's ddl-auto days and did not, so deleting a user was refused
-- while any goal, entry, place or report still pointed at it.
--
-- Production's constraints were named by Hibernate and a fresh database's by
-- Postgres, so they are looked up rather than named: whatever foreign key
-- each column has is dropped, then one with a known name is added.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT c.conname, c.conrelid::regclass AS tbl
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f'
          AND (
                (c.confrelid = 'users'::regclass AND a.attname = 'user_id'
                 AND c.conrelid IN ('goals'::regclass, 'behaviors'::regclass,
                                    'locations'::regclass, 'reports'::regclass))
             OR (c.confrelid = 'goals'::regclass AND a.attname = 'goal_id'
                 AND c.conrelid = 'behaviors'::regclass)
          )
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    END LOOP;
END $$;

ALTER TABLE goals     ADD CONSTRAINT goals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE behaviors ADD CONSTRAINT behaviors_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE locations ADD CONSTRAINT locations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE reports   ADD CONSTRAINT reports_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- An entry can point at a goal that belongs to someone else: a shared goal
-- the person has since left keeps their entries ("their entries stay
-- theirs"). When that goal goes with its owner's account, those entries stay
-- too, no longer attached to a goal, instead of blocking the deletion.
ALTER TABLE behaviors ADD CONSTRAINT behaviors_goal_id_fkey
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL;

-- Which version of the Terms someone agreed to, and when. Null for accounts
-- made before the Terms existed.
ALTER TABLE users ADD COLUMN terms_version     VARCHAR(20);
ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMP;
