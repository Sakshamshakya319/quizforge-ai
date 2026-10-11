import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Reconciles any existing duplicate active (in_progress / paused) attempts,
 * ensures the database schema supports 'abandoned' status and enforces
 * database-level active-attempt uniqueness via a persistent generated column.
 */
export async function initAttemptSchemaAndReconcile() {
    const connection = await pool.getConnection();
    try {
        console.log('[Reconciliation] Checking attempt schema and active uniqueness...');

        // 1. Ensure status enum includes 'abandoned'
        const [statusCol] = await connection.execute(`
            SELECT COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'quiz_attempts' 
              AND COLUMN_NAME = 'status'
        `);

        if (statusCol.length > 0 && !statusCol[0].COLUMN_TYPE.includes('abandoned')) {
            console.log('[Reconciliation] Updating status enum to include "abandoned"...');
            await connection.execute(`
                ALTER TABLE quiz_attempts 
                MODIFY COLUMN status ENUM('in_progress','paused','completed','abandoned') 
                NOT NULL DEFAULT 'in_progress'
            `);
            console.log('[Reconciliation] Status enum updated successfully.');
        }

        // 2. Find and reconcile duplicate active attempts before applying unique constraint
        const [activeAttempts] = await connection.execute(`
            SELECT id, quiz_id, user_id, status, started_at, paused_at, last_saved_at, 
                   current_question_index, elapsed_seconds, created_at
            FROM quiz_attempts
            WHERE status IN ('in_progress', 'paused')
            ORDER BY quiz_id, user_id,
                     CASE status WHEN 'paused' THEN 0 ELSE 1 END,
                     COALESCE(last_saved_at, paused_at, started_at) DESC
        `);

        // Group by `${quiz_id}:${user_id || 'anonymous'}`
        const groups = {};
        for (const att of activeAttempts) {
            const key = `${att.quiz_id}:${att.user_id || 'anonymous'}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(att);
        }

        for (const [key, attempts] of Object.entries(groups)) {
            if (attempts.length <= 1) continue;

            console.log(`[Reconciliation] Found ${attempts.length} active attempts for ${key}. Reconciling...`);
            const canonical = attempts[0]; // Highest priority based on sort order
            console.log(`[Reconciliation] Selected canonical attempt: ${canonical.id} (status: ${canonical.status})`);

            // Fetch answers from canonical attempt
            const [canonicalAnswers] = await connection.execute(`
                SELECT * FROM attempt_answers WHERE attempt_id = ?
            `, [canonical.id]);
            const canonicalAnsMap = new Map();
            for (const ans of canonicalAnswers) {
                canonicalAnsMap.set(ans.question_id, ans);
            }

            // Merge answers from other attempts into canonical
            let maxElapsed = canonical.elapsed_seconds || 0;
            let maxQuestionIndex = canonical.current_question_index || 0;

            for (let i = 1; i < attempts.length; i++) {
                const dup = attempts[i];
                if ((dup.elapsed_seconds || 0) > maxElapsed) {
                    maxElapsed = dup.elapsed_seconds;
                }
                if ((dup.current_question_index || 0) > maxQuestionIndex) {
                    maxQuestionIndex = dup.current_question_index;
                }

                const [dupAnswers] = await connection.execute(`
                    SELECT * FROM attempt_answers WHERE attempt_id = ?
                `, [dup.id]);

                for (const ans of dupAnswers) {
                    const existing = canonicalAnsMap.get(ans.question_id);
                    if (!existing) {
                        // Insert answer into canonical attempt
                        const newAnsId = uuidv4();
                        await connection.execute(`
                            INSERT INTO attempt_answers 
                              (id, attempt_id, question_id, selected_option_id, is_correct, is_flagged, answered_at, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            newAnsId,
                            canonical.id,
                            ans.question_id,
                            ans.selected_option_id,
                            ans.is_correct,
                            ans.is_flagged || 0,
                            ans.answered_at,
                            ans.created_at,
                            ans.updated_at
                        ]);
                        canonicalAnsMap.set(ans.question_id, { ...ans, id: newAnsId });
                    } else if (ans.selected_option_id && !existing.selected_option_id) {
                        // If canonical had no selection but dup did, copy selection
                        await connection.execute(`
                            UPDATE attempt_answers 
                            SET selected_option_id = ?, is_flagged = ?
                            WHERE id = ?
                        `, [ans.selected_option_id, ans.is_flagged || 0, existing.id]);
                    }
                }

                // Mark dup attempt as abandoned
                await connection.execute(`
                    UPDATE quiz_attempts 
                    SET status = 'abandoned' 
                    WHERE id = ?
                `, [dup.id]);
                console.log(`[Reconciliation] Redundant attempt ${dup.id} marked as 'abandoned'.`);
            }

            // Update canonical attempt with merged progress & saved timestamp
            await connection.execute(`
                UPDATE quiz_attempts 
                SET elapsed_seconds = ?,
                    current_question_index = ?,
                    last_saved_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [maxElapsed, maxQuestionIndex, canonical.id]);
        }

        // 3. Ensure active_attempt_key column exists
        const [keyCol] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'quiz_attempts' 
              AND COLUMN_NAME = 'active_attempt_key'
        `);

        if (keyCol.length === 0) {
            console.log('[Reconciliation] Adding active_attempt_key persistent generated column...');
            await connection.execute(`
                ALTER TABLE quiz_attempts 
                ADD COLUMN active_attempt_key VARCHAR(100) AS (
                    CASE WHEN status IN ('in_progress', 'paused')
                         THEN CONCAT(quiz_id, ':', COALESCE(user_id, 'anonymous'))
                         ELSE NULL
                    END
                ) PERSISTENT
            `);
            console.log('[Reconciliation] Column active_attempt_key added.');
        }

        // 4. Ensure unique index on active_attempt_key exists
        const [uqIdx] = await connection.execute(`
            SELECT INDEX_NAME 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'quiz_attempts' 
              AND INDEX_NAME = 'uq_active_attempt'
        `);

        if (uqIdx.length === 0) {
            console.log('[Reconciliation] Adding unique index uq_active_attempt...');
            await connection.execute(`
                ALTER TABLE quiz_attempts 
                ADD UNIQUE KEY uq_active_attempt (active_attempt_key)
            `);
            console.log('[Reconciliation] Unique index uq_active_attempt created successfully.');
        }

        console.log('[Reconciliation] Schema & reconciliation completed successfully.');
    } catch (err) {
        console.error('[Reconciliation] Error:', err);
        throw err;
    } finally {
        connection.release();
    }
}
