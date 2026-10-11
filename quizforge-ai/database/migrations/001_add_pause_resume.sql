-- ─────────────────────────────────────────────────────────────────────────────
--  Migration 001 — Add pause / resume support
--
--  Safe, additive-only migration.  No existing columns are dropped or renamed.
--  Run once against the quizforge_ai database.
--
--  To apply:
--    mysql -u root quizforge_ai < database/migrations/001_add_pause_resume.sql
-- ─────────────────────────────────────────────────────────────────────────────

USE quizforge_ai;

-- 1. Extend the status enum to include 'paused'.
--    MySQL ALTER TABLE MODIFY is safe for ENUM widening (adds a new allowed value).
ALTER TABLE quiz_attempts
  MODIFY COLUMN status ENUM('in_progress', 'paused', 'completed') NOT NULL DEFAULT 'in_progress';

-- 2. Add pause-specific columns to quiz_attempts.
--    Each uses IF NOT EXISTS syntax (via the conditional pattern below) so the
--    migration is idempotent — re-running it will not throw if columns exist.

-- current_question_index: the 0-based index of the question the user was on
-- when they paused.  Stored as an integer because questions are ordered and
-- the index is cheaper to restore than a full question-ID lookup.
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS current_question_index INT NOT NULL DEFAULT 0;

-- elapsed_seconds: seconds of active quiz-taking time accumulated before this
-- pause.  Used to restore the elapsed-time counter accurately.
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS elapsed_seconds INT NOT NULL DEFAULT 0;

-- paused_at: exact timestamp when the user last paused.
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP NULL DEFAULT NULL;

-- last_saved_at: updated on every autosave and on explicit pause.
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMP NULL DEFAULT NULL;
