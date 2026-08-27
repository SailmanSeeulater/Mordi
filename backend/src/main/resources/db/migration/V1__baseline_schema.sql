-- V1__baseline_schema.sql
--
-- Baseline migration. This captures the schema as it currently exists in
-- production, generated historically by Hibernate's ddl-auto=update. From
-- this point forward, all schema changes go through numbered Flyway
-- migrations (V2, V3, ...) instead of letting Hibernate infer changes.
--
-- IMPORTANT: before this runs against the real production database, see the
-- deployment note at the bottom of this file — existing databases must be
-- baselined, not migrated from empty, or Flyway will try to CREATE TABLE
-- against tables that already exist and fail.

CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP
);

CREATE TABLE goals (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    title       VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    frequency   VARCHAR(255),
    category    VARCHAR(255),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP
);

CREATE TABLE behaviors (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    goal_id     BIGINT REFERENCES goals(id),
    note        VARCHAR(255) NOT NULL,
    completed   BOOLEAN NOT NULL DEFAULT FALSE,
    mood        VARCHAR(255),
    log_date    DATE NOT NULL,
    created_at  TIMESTAMP
);

CREATE TABLE locations (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    place_name  VARCHAR(255),
    recorded_at TIMESTAMP
);

CREATE TABLE reports (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id),
    week_start          DATE NOT NULL,
    week_end            DATE NOT NULL,
    total_behaviors     INTEGER,
    completed_behaviors INTEGER,
    completion_rate     DOUBLE PRECISION,
    most_common_mood    VARCHAR(255),
    summary             VARCHAR(1000),
    created_at          TIMESTAMP
);

-- Indexes on foreign keys. Hibernate's ddl-auto=update does NOT create these
-- automatically for @ManyToOne columns, so if these weren't manually added,
-- every "get my goals" / "get my behaviors" / "get my locations" query has
-- been doing a full table scan filtered by user_id. Cheap to add, real
-- query-plan improvement even at small data volumes.
CREATE INDEX idx_goals_user_id       ON goals(user_id);
CREATE INDEX idx_behaviors_user_id   ON behaviors(user_id);
CREATE INDEX idx_behaviors_goal_id   ON behaviors(goal_id);
CREATE INDEX idx_locations_user_id   ON locations(user_id);
CREATE INDEX idx_reports_user_id     ON reports(user_id);

-- ============================================================================
-- DEPLOYMENT NOTE — read before running against production
-- ============================================================================
-- Your production database already has these tables (created by Hibernate's
-- ddl-auto=update over time). If Flyway runs this migration against that
-- existing database, CREATE TABLE will fail because the tables are already
-- there.
--
-- The correct one-time step is to BASELINE, not migrate:
--
--   1. Deploy this migration + the Flyway dependency/config, but do NOT let
--      Flyway run automatically yet.
--   2. On the production DB, run:
--        ./mvnw flyway:baseline -Dflyway.baselineVersion=1
--      (or the equivalent flyway CLI / Docker command)
--      This tells Flyway "V1 is already applied, just start tracking from
--      here" without attempting to re-run the CREATE TABLE statements.
--   3. From then on, ddl-auto is set to 'validate' (see application.properties
--      change), so Hibernate checks the schema matches but never mutates it.
--      All future changes are new Vn__description.sql files.
--
-- Do this on a database backup first if at all possible (see the backup
-- work later in this step) — baselining is safe, but "safe" and "did it on
-- production with no backup" shouldn't be the same sentence.
-- ============================================================================