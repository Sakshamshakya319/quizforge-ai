-- ─────────────────────────────────────────────────────────────────────────────
--  Migration 002 — Add active-attempt uniqueness and 'abandoned' status
--
--  Safe, additive migration.
--  1. Expands status ENUM to include 'abandoned'.
--  2. Adds active_attempt_key generated persistent column (NULL for non-active).
--  3. Adds unique index uq_active_attempt to guarantee at most 1 active attempt
--     per quiz and user.
--
--  To apply:
--    mysql -u root quizforge_ai < database/migrations/002_add_active_attempt_uniqueness.sql
-- ─────────────────────────────────────────────────────────────────────────────

USE quizforge_ai;

-- 1. Extend the status enum to include 'abandoned'
ALTER TABLE quiz_attempts 
  MODIFY COLUMN status ENUM('in_progress', 'paused', 'completed', 'abandoned') 
  NOT NULL DEFAULT 'in_progress';

-- 2. Add PERSISTENT generated column that is non-null ONLY for active attempts
ALTER TABLE quiz_attempts 
  ADD COLUMN IF NOT EXISTS active_attempt_key VARCHAR(100) AS (
    CASE WHEN status IN ('in_progress', 'paused')
         THEN CONCAT(quiz_id, ':', COALESCE(user_id, 'anonymous'))
         ELSE NULL
    END
  ) PERSISTENT;

-- 3. Add UNIQUE index on active_attempt_key
ALTER TABLE quiz_attempts 
  ADD UNIQUE KEY IF NOT EXISTS uq_active_attempt (active_attempt_key);
