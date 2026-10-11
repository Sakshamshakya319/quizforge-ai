import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export const createQuiz = async (req, res, next) => {
    try {
        const { title, description, document_id } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: 'Title is required.' });
        }

        const id = uuidv4();
        const query = 'INSERT INTO quizzes (id, title, description, document_id) VALUES (?, ?, ?, ?)';
        await pool.execute(query, [id, title, description || null, document_id || null]);
        
        res.status(201).json({ id, title, document_id });
    } catch (err) {
        next(err);
    }
};

export const getQuizzes = async (req, res, next) => {
    try {
        const [quizzes] = await pool.execute(`
            SELECT q.*, 
            (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
            d.original_filename as sourceFile
            FROM quizzes q
            LEFT JOIN documents d ON q.document_id = d.id
            ORDER BY q.created_at DESC
        `);

        for (let q of quizzes) {
            const [attempts] = await pool.execute(`
                SELECT id, score_percentage as score, verified_questions_count as totalQuestions, status
                FROM quiz_attempts 
                WHERE quiz_id = ? AND status = 'completed'
                ORDER BY created_at ASC
            `, [q.id]);
            
            q.attempts = attempts;
            q.questions = new Array(Number(q.question_count)); // Dummy array so .length works in frontend
        }

        res.json(quizzes);
    } catch (err) {
        next(err);
    }
};

export const getQuiz = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute('SELECT * FROM quizzes WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Quiz not found.' });
        }
        
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
};

export const updateQuiz = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, description, settings_json } = req.body;
        
        const query = 'UPDATE quizzes SET title = COALESCE(?, title), description = COALESCE(?, description), settings_json = COALESCE(?, settings_json) WHERE id = ?';
        const [result] = await pool.execute(query, [title, description, settings_json ? JSON.stringify(settings_json) : null, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Quiz not found.' });
        }
        
        res.json({ message: 'Quiz updated successfully.' });
    } catch (err) {
        next(err);
    }
};

export const deleteQuiz = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;

        if (!id || typeof id !== 'string' || id.trim() === '') {
            return res.status(400).json({ error: 'Invalid quiz ID.' });
        }

        await connection.beginTransaction();

        // 1. Verify the quiz exists and capture its document_id for later cleanup.
        const [quizRows] = await connection.execute(
            'SELECT id, document_id FROM quizzes WHERE id = ? FOR UPDATE',
            [id]
        );

        if (quizRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Quiz not found.' });
        }

        const documentId = quizRows[0].document_id;

        // 2. Delete the quiz. MySQL CASCADE FKs automatically remove in order:
        //    quizzes → questions → question_options
        //                       → attempt_answers
        //                       → tutor_conversations → tutor_messages
        //             quiz_attempts (also cascade → attempt_answers, tutor_conversations)
        await connection.execute('DELETE FROM quizzes WHERE id = ?', [id]);

        // 3. Clean up the now-orphaned document record (if this quiz had one).
        //    Only delete the document if no other quiz still references it.
        if (documentId) {
            const [otherRefs] = await connection.execute(
                'SELECT id FROM quizzes WHERE document_id = ? LIMIT 1',
                [documentId]
            );
            if (otherRefs.length === 0) {
                await connection.execute('DELETE FROM documents WHERE id = ?', [documentId]);
            }
        }

        await connection.commit();
        res.json({ message: 'Quiz deleted permanently.', quizId: id });
    } catch (err) {
        await connection.rollback();
        next(err);
    } finally {
        connection.release();
    }
};

export const saveQuestionsBulk = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { quizId } = req.params;
        const { questions } = req.body;
        
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Questions must be a non-empty array.' });
        }

        await connection.beginTransaction();

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];

            // Validate required question fields before inserting
            if (!q.questionText || typeof q.questionText !== 'string' || !q.questionText.trim()) {
                await connection.rollback();
                return res.status(400).json({ error: `Question at index ${i} is missing questionText.` });
            }
            if (!Array.isArray(q.options) || q.options.length < 2) {
                await connection.rollback();
                return res.status(400).json({ error: `Question at index ${i} ("${q.questionText.slice(0, 40)}") has fewer than 2 options.` });
            }

            const qId = q.id || uuidv4();
            
            await connection.execute(`
                INSERT INTO questions (id, quiz_id, question_text, question_order, explanation, verification_status, extraction_confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                qId,
                quizId,
                q.questionText.trim(),
                i,
                q.explanation || null,
                q.verificationStatus || 'unverified',
                q.extractionConfidence || null
            ]);
            
            for (let j = 0; j < q.options.length; j++) {
                const opt = q.options[j];

                // Guard: option must carry both label and text so the DB never
                // stores an empty or undefined value for either column.
                const optLabel = (opt.label || '').toString().trim();
                const optText  = (opt.text  || '').toString().trim();

                if (!optLabel || !optText) {
                    await connection.rollback();
                    return res.status(400).json({
                        error: `Question ${i + 1}, option ${j + 1}: label ("${optLabel}") or text ("${optText}") is empty. Publish aborted.`
                    });
                }

                const isCorrect = q.correctOptionId === opt.id ? 1 : 0;
                const optId     = opt.id || uuidv4();
                
                await connection.execute(`
                    INSERT INTO question_options (id, question_id, option_label, option_text, is_correct, option_order)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [optId, qId, optLabel, optText, isCorrect, j]);
            }
        }

        await connection.commit();
        res.status(201).json({ message: 'Questions saved successfully.', count: questions.length });
    } catch (err) {
        await connection.rollback();
        next(err);
    } finally {
        connection.release();
    }
};

export const getQuizQuestions = async (req, res, next) => {
    try {
        const { quizId } = req.params;
        
        const [questions] = await pool.execute(
            'SELECT * FROM questions WHERE quiz_id = ? ORDER BY question_order ASC',
            [quizId]
        );
        
        const result = questions.map(q => {
            // Map snake_case question columns → camelCase contract
            const mapped = {
                id:                   q.id,
                quiz_id:              q.quiz_id,
                questionText:         q.question_text,
                questionOrder:        q.question_order,
                explanation:          q.explanation   || null,
                verificationStatus:   q.verification_status,
                extractionConfidence: q.extraction_confidence,
                options:              [],
                correctOptionId:      null,
            };
            return mapped;
        });

        // Load options for every question in one round-trip per question.
        // Map option_label → label, option_text → text so the frontend
        // camelCase contract (opt.label / opt.text) is always satisfied.
        for (const q of result) {
            const [optRows] = await pool.execute(
                'SELECT * FROM question_options WHERE question_id = ? ORDER BY option_order ASC',
                [q.id]
            );

            q.options = optRows.map(o => ({
                id:           o.id,
                question_id:  o.question_id,
                label:        o.option_label,   // DB: option_label  → frontend: label
                text:         o.option_text,    // DB: option_text   → frontend: text
                is_correct:   o.is_correct,
                option_order: o.option_order,
            }));

            const correctOpt = q.options.find(o => o.is_correct === 1 || o.is_correct === true);
            if (correctOpt) {
                q.correctOptionId = correctOpt.id;
            }
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
};
