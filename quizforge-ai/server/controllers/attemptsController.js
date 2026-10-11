import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
//  startAttempt  POST /api/attempts/quiz/:quizId
//
//  Enforces at most ONE active attempt (in_progress or paused) per quiz.
//  If an active attempt already exists, returns that attempt (idempotent).
//  If forceNew=true is passed, marks the previous active attempt as 'abandoned'
//  and creates a fresh attempt.
// ─────────────────────────────────────────────────────────────────────────────
export const startAttempt = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { quizId } = req.params;
        const { forceNew = false } = req.body || {};
        const userId = req.user?.id || null;

        await connection.beginTransaction();

        // 1. Verify that the quiz exists
        const [quizzes] = await connection.execute(
            'SELECT id, title FROM quizzes WHERE id = ? FOR UPDATE',
            [quizId]
        );
        if (quizzes.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Quiz not found.' });
        }

        // 2. Search for existing active attempt (in_progress or paused)
        const [existing] = await connection.execute(
            `SELECT * FROM quiz_attempts
             WHERE quiz_id = ?
               AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))
               AND status IN ('in_progress', 'paused')
             ORDER BY
               CASE status WHEN 'paused' THEN 0 ELSE 1 END ASC,
               COALESCE(last_saved_at, paused_at, started_at) DESC
             LIMIT 1 FOR UPDATE`,
            [quizId, userId, userId]
        );

        if (existing.length > 0) {
            if (forceNew) {
                // Abandon the previous active attempt to make room for a new one
                await connection.execute(
                    "UPDATE quiz_attempts SET status = 'abandoned' WHERE id = ?",
                    [existing[0].id]
                );
            } else {
                // Return the existing active attempt
                const activeAttempt = existing[0];
                const [answers] = await connection.execute(
                    'SELECT * FROM attempt_answers WHERE attempt_id = ?',
                    [activeAttempt.id]
                );
                await connection.commit();
                return res.status(200).json({
                    id: activeAttempt.id,
                    quizId: activeAttempt.quiz_id,
                    status: activeAttempt.status,
                    current_question_index: activeAttempt.current_question_index,
                    elapsed_seconds: activeAttempt.elapsed_seconds,
                    last_saved_at: activeAttempt.last_saved_at,
                    total_questions: activeAttempt.total_questions,
                    answers,
                    isExisting: true
                });
            }
        }

        // 3. No active attempt exists (or old was abandoned via forceNew) -> create fresh attempt
        const [counts] = await connection.execute(
            'SELECT COUNT(*) as total FROM questions WHERE quiz_id = ?',
            [quizId]
        );
        const total_questions = counts[0].total;
        const id = uuidv4();

        await connection.execute(
            `INSERT INTO quiz_attempts (id, quiz_id, user_id, status, total_questions) 
             VALUES (?, ?, ?, 'in_progress', ?)`,
            [id, quizId, userId, total_questions]
        );

        await connection.commit();
        res.status(201).json({
            id,
            quizId,
            status: 'in_progress',
            total_questions,
            current_question_index: 0,
            elapsed_seconds: 0,
            answers: [],
            isExisting: false
        });
    } catch (err) {
        await connection.rollback();
        // Concurrency safeguard: If another concurrent request inserted an active attempt in the exact same millisecond
        if (err.code === 'ER_DUP_ENTRY') {
            try {
                const [active] = await pool.execute(
                    `SELECT * FROM quiz_attempts
                     WHERE quiz_id = ? AND status IN ('in_progress', 'paused')
                     ORDER BY COALESCE(last_saved_at, paused_at, started_at) DESC LIMIT 1`,
                    [req.params.quizId]
                );
                if (active.length > 0) {
                    const [answers] = await pool.execute(
                        'SELECT * FROM attempt_answers WHERE attempt_id = ?',
                        [active[0].id]
                    );
                    return res.status(200).json({
                        id: active[0].id,
                        quizId: active[0].quiz_id,
                        status: active[0].status,
                        current_question_index: active[0].current_question_index,
                        elapsed_seconds: active[0].elapsed_seconds,
                        last_saved_at: active[0].last_saved_at,
                        total_questions: active[0].total_questions,
                        answers,
                        isExisting: true
                    });
                }
            } catch (innerErr) {
                return next(innerErr);
            }
        }
        next(err);
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getAttempt  GET /api/attempts/:id
//
//  Returns the attempt row plus all saved answers.
// ─────────────────────────────────────────────────────────────────────────────
export const getAttempt = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute(
            'SELECT * FROM quiz_attempts WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Attempt not found.' });
        }

        const [answers] = await pool.execute(
            'SELECT * FROM attempt_answers WHERE attempt_id = ?',
            [id]
        );
        rows[0].answers = answers;

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getInProgressAttempt  GET /api/attempts/quiz/:quizId/in-progress
//
//  Returns the most-recent active (paused or in_progress) attempt for a quiz.
//  Returns 404 when none exists.
// ─────────────────────────────────────────────────────────────────────────────
export const getInProgressAttempt = async (req, res, next) => {
    try {
        const { quizId } = req.params;
        const userId = req.user?.id || null;

        const [rows] = await pool.execute(
            `SELECT * FROM quiz_attempts
             WHERE quiz_id = ? 
               AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))
               AND status IN ('paused','in_progress')
             ORDER BY
               CASE status WHEN 'paused' THEN 0 ELSE 1 END ASC,
               COALESCE(last_saved_at, paused_at, started_at) DESC
             LIMIT 1`,
            [quizId, userId, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No resumable attempt found.' });
        }

        const attempt = rows[0];
        const [answers] = await pool.execute(
            'SELECT * FROM attempt_answers WHERE attempt_id = ?',
            [attempt.id]
        );
        attempt.answers = answers;

        res.json(attempt);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  saveAnswer  PUT /api/attempts/:id/answers/:questionId
//
//  Idempotent upsert for a single answer.  Also accepts is_flagged so the
//  frontend can persist flag state in the same call.
//  Allowed when status is 'in_progress' OR 'paused'.
//  Updates last_saved_at on the attempt.
// ─────────────────────────────────────────────────────────────────────────────
export const saveAnswer = async (req, res, next) => {
    try {
        const { id, questionId } = req.params;
        const { selected_option_id, is_flagged } = req.body;

        const [attempts] = await pool.execute(
            'SELECT status FROM quiz_attempts WHERE id = ?',
            [id]
        );
        if (attempts.length === 0) {
            return res.status(404).json({ error: 'Attempt not found.' });
        }
        if (attempts[0].status === 'completed') {
            return res.status(400).json({ error: 'Cannot modify a completed attempt.' });
        }
        if (attempts[0].status === 'abandoned') {
            return res.status(400).json({ error: 'Cannot modify an abandoned attempt.' });
        }

        const answerId = uuidv4();

        // Build dynamic upsert depending on which fields were supplied
        if (is_flagged !== undefined && selected_option_id !== undefined) {
            await pool.execute(
                `INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option_id, is_flagged, answered_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                 ON DUPLICATE KEY UPDATE
                   selected_option_id = VALUES(selected_option_id),
                   is_flagged         = VALUES(is_flagged),
                   answered_at        = CURRENT_TIMESTAMP`,
                [answerId, id, questionId, selected_option_id, is_flagged ? 1 : 0]
            );
        } else if (is_flagged !== undefined) {
            await pool.execute(
                `INSERT INTO attempt_answers (id, attempt_id, question_id, is_flagged)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE is_flagged = VALUES(is_flagged)`,
                [answerId, id, questionId, is_flagged ? 1 : 0]
            );
        } else {
            await pool.execute(
                `INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option_id, answered_at)
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                 ON DUPLICATE KEY UPDATE 
                   selected_option_id = VALUES(selected_option_id),
                   answered_at        = CURRENT_TIMESTAMP`,
                [answerId, id, questionId, selected_option_id]
            );
        }

        // Stamp last_saved_at on the attempt row
        await pool.execute(
            'UPDATE quiz_attempts SET last_saved_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        res.json({ message: 'Answer saved.' });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  pauseAttempt  PATCH/POST /api/attempts/:id/pause
//
//  Atomically:
//    1. Validates the attempt exists and is pauseable (in_progress or paused).
//    2. Saves all pending answer updates passed in the request body.
//    3. Persists current_question_index and elapsed_seconds.
//    4. Sets status = 'paused', paused_at, last_saved_at.
//  Returns the updated attempt summary (no answer key exposed).
// ─────────────────────────────────────────────────────────────────────────────
export const pauseAttempt = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const {
            current_question_index = 0,
            elapsed_seconds        = 0,
            answers = [],          // [{ question_id, selected_option_id, is_flagged }]
        } = req.body;

        await connection.beginTransaction();

        // Lock the row for this transaction
        const [rows] = await connection.execute(
            'SELECT id, status FROM quiz_attempts WHERE id = ? FOR UPDATE',
            [id]
        );
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Attempt not found.' });
        }
        if (rows[0].status === 'completed') {
            await connection.rollback();
            return res.status(400).json({ error: 'Cannot pause a completed attempt.' });
        }
        if (rows[0].status === 'abandoned') {
            await connection.rollback();
            return res.status(400).json({ error: 'Cannot pause an abandoned attempt.' });
        }

        // Upsert every answer provided (batch)
        for (const ans of answers) {
            if (!ans.question_id) continue;
            const aId = uuidv4();
            await connection.execute(
                `INSERT INTO attempt_answers
                   (id, attempt_id, question_id, selected_option_id, is_flagged, answered_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                 ON DUPLICATE KEY UPDATE
                   selected_option_id = VALUES(selected_option_id),
                   is_flagged         = VALUES(is_flagged),
                   answered_at        = CURRENT_TIMESTAMP`,
                [
                    aId,
                    id,
                    ans.question_id,
                    ans.selected_option_id || null,
                    ans.is_flagged ? 1 : 0,
                ]
            );
        }

        // Update the attempt to 'paused' with position + timing
        await connection.execute(
            `UPDATE quiz_attempts
             SET status                 = 'paused',
                 current_question_index = ?,
                 elapsed_seconds        = ?,
                 paused_at              = CURRENT_TIMESTAMP,
                 last_saved_at          = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [current_question_index, elapsed_seconds, id]
        );

        await connection.commit();

        // Return the updated row
        const [updated] = await pool.execute(
            `SELECT id, quiz_id, status, current_question_index,
                    elapsed_seconds, paused_at, last_saved_at,
                    total_questions, started_at
             FROM quiz_attempts WHERE id = ?`,
            [id]
        );

        res.json({ message: 'Quiz paused successfully.', attempt: updated[0] });
    } catch (err) {
        await connection.rollback();
        console.error('[pauseAttempt] Error:', err.message);
        next(err);
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  resumeAttempt  PATCH /api/attempts/:id/resume
//
//  Transitions a paused attempt back to in_progress.
//  Returns the full attempt with all saved answers.
// ─────────────────────────────────────────────────────────────────────────────
export const resumeAttempt = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;

        await connection.beginTransaction();

        const [rows] = await connection.execute(
            'SELECT * FROM quiz_attempts WHERE id = ? FOR UPDATE',
            [id]
        );
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Attempt not found.' });
        }
        if (rows[0].status === 'completed') {
            await connection.rollback();
            return res.status(400).json({ error: 'Cannot resume a completed attempt.' });
        }
        if (rows[0].status === 'abandoned') {
            await connection.rollback();
            return res.status(400).json({ error: 'Cannot resume an abandoned attempt.' });
        }
        if (rows[0].status === 'in_progress') {
            // Already active — idempotent, just return current state
            await connection.rollback();
            const [answers] = await pool.execute(
                'SELECT * FROM attempt_answers WHERE attempt_id = ?',
                [id]
            );
            return res.json({ ...rows[0], answers });
        }

        await connection.execute(
            `UPDATE quiz_attempts
             SET status        = 'in_progress',
                 last_saved_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [id]
        );

        await connection.commit();

        const [updated] = await pool.execute(
            'SELECT * FROM quiz_attempts WHERE id = ?',
            [id]
        );
        const [answers] = await pool.execute(
            'SELECT * FROM attempt_answers WHERE attempt_id = ?',
            [id]
        );

        res.json({ ...updated[0], answers });
    } catch (err) {
        await connection.rollback();
        console.error('[resumeAttempt] Error:', err.message);
        next(err);
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  submitAttempt  POST /api/attempts/:id/submit
//
//  Scores only verified questions. Works whether the attempt was paused or
//  in_progress. Idempotent if called repeatedly.
// ─────────────────────────────────────────────────────────────────────────────
export const submitAttempt = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { duration_seconds } = req.body;

        await connection.beginTransaction();

        const [attempts] = await connection.execute(
            'SELECT * FROM quiz_attempts WHERE id = ? FOR UPDATE',
            [id]
        );
        if (attempts.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Attempt not found.' });
        }
        const attempt = attempts[0];

        if (attempt.status === 'completed') {
            await connection.rollback();
            return res.status(200).json({
                message: 'Attempt already completed.',
                score_percentage: attempt.score_percentage,
                isAlreadyCompleted: true
            });
        }
        if (attempt.status === 'abandoned') {
            await connection.rollback();
            return res.status(400).json({ error: 'Cannot submit an abandoned attempt.' });
        }

        const [questions] = await connection.execute(
            'SELECT id FROM questions WHERE quiz_id = ? AND verification_status = "verified"',
            [attempt.quiz_id]
        );
        const verifiedQIds = questions.map(q => q.id);

        let correctCount   = 0;
        let incorrectCount = 0;
        let unansweredCount = verifiedQIds.length;

        const [answers] = await connection.execute(
            'SELECT * FROM attempt_answers WHERE attempt_id = ?',
            [id]
        );

        for (const answer of answers) {
            if (!verifiedQIds.includes(answer.question_id)) continue;
            unansweredCount--;

            const [options] = await connection.execute(
                'SELECT is_correct FROM question_options WHERE id = ? AND question_id = ?',
                [answer.selected_option_id, answer.question_id]
            );
            const isCorrect = options.length > 0 && options[0].is_correct === 1;
            await connection.execute(
                'UPDATE attempt_answers SET is_correct = ? WHERE id = ?',
                [isCorrect, answer.id]
            );
            if (isCorrect) correctCount++;
            else incorrectCount++;
        }

        const verified_questions_count = verifiedQIds.length;
        const score_percentage = verified_questions_count > 0
            ? (correctCount / verified_questions_count) * 100
            : 0;

        await connection.execute(
            `UPDATE quiz_attempts
             SET status                  = 'completed',
                 completed_at            = CURRENT_TIMESTAMP,
                 verified_questions_count = ?,
                 correct_count           = ?,
                 incorrect_count         = ?,
                 unanswered_count        = ?,
                 score_percentage        = ?,
                 duration_seconds        = ?
             WHERE id = ?`,
            [
                verified_questions_count, correctCount, incorrectCount,
                unansweredCount, score_percentage,
                duration_seconds || null, id,
            ]
        );

        await connection.commit();
        res.json({ message: 'Attempt submitted successfully.', score_percentage });
    } catch (err) {
        await connection.rollback();
        next(err);
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getAttemptResults  GET /api/attempts/:id/results
// ─────────────────────────────────────────────────────────────────────────────
export const getAttemptResults = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute(
            'SELECT * FROM quiz_attempts WHERE id = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Attempt not found.' });
        }

        const [answers] = await pool.execute(
            'SELECT * FROM attempt_answers WHERE attempt_id = ?',
            [id]
        );

        const [explanations] = await pool.execute(
            `SELECT m.message_text, c.question_id
             FROM tutor_messages m
             JOIN tutor_conversations c ON m.conversation_id = c.id
             WHERE c.attempt_id = ? AND m.role = 'assistant'
             ORDER BY m.created_at ASC`,
            [id]
        );

        const aiExplanations = {};
        for (const exp of explanations) {
            if (!aiExplanations[exp.question_id]) {
                aiExplanations[exp.question_id] = exp.message_text;
            }
        }

        res.json({ attempt: rows[0], answers, aiExplanations });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getHistory  GET /api/attempts/history
//  Returns all non-abandoned attempts grouped by quiz.
// ─────────────────────────────────────────────────────────────────────────────
export const getHistory = async (req, res, next) => {
    try {
        const userId = req.user?.id || null;
        const [history] = await pool.execute(
            `SELECT a.*,
                    q.title as quiz_title,
                    (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as quiz_question_count,
                    (SELECT COUNT(DISTINCT aa.question_id)
                     FROM attempt_answers aa
                     WHERE aa.attempt_id = a.id
                       AND aa.selected_option_id IS NOT NULL) AS answered_count
             FROM quiz_attempts a
             JOIN quizzes q ON a.quiz_id = q.id
             WHERE a.status != 'abandoned'
               AND (a.user_id = ? OR (a.user_id IS NULL AND ? IS NULL))
             ORDER BY COALESCE(a.completed_at, a.last_saved_at, a.started_at) DESC`,
            [userId, userId]
        );
        res.json(history);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getErrors  GET /api/attempts/errors
// ─────────────────────────────────────────────────────────────────────────────
export const getErrors = async (req, res, next) => {
    try {
        const [errors] = await pool.execute(
            `SELECT ans.*,
                 q.question_text, q.explanation as original_explanation,
                 opt.option_text as selected_option_text,
                 (SELECT option_text FROM question_options
                  WHERE question_id = q.id AND is_correct = 1 LIMIT 1) as correct_option_text,
                 qz.title as quiz_title, a.id as attempt_id
             FROM attempt_answers ans
             JOIN questions q       ON ans.question_id        = q.id
             JOIN question_options opt ON ans.selected_option_id = opt.id
             JOIN quiz_attempts a   ON ans.attempt_id         = a.id
             JOIN quizzes qz        ON a.quiz_id              = qz.id
             WHERE opt.is_correct = 0 AND a.status = 'completed'
             ORDER BY ans.answered_at DESC`
        );
        res.json(errors);
    } catch (err) {
        next(err);
    }
};
