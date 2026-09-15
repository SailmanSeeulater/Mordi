ALTER TABLE goals ADD COLUMN target_per_week INTEGER NOT NULL DEFAULT 1;

UPDATE goals SET target_per_week = 7 WHERE frequency = 'daily';
