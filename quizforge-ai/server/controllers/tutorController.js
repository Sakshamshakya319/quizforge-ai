import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// Base URL for the local FastAPI inference service.
// Override via QWEN_TUTOR_API_URL in .env.
const TUTOR_API_URL = process.env.QWEN_TUTOR_API_URL || 'http://127.0.0.1:8001/api/v1/tutor/chat';

// ─────────────────────────────────────────────────────────────────────────────
//  createConversation
// ─────────────────────────────────────────────────────────────────────────────
export const createConversation = async (req, res, next) => {
    try {
        const { attempt_id, question_id } = req.body;
        const id = uuidv4();

        await pool.execute(
            'INSERT INTO tutor_conversations (id, attempt_id, question_id) VALUES (?, ?, ?)',
            [id, attempt_id || null, question_id || null]
        );

        res.status(201).json({ id, attempt_id, question_id });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getConversation
// ─────────────────────────────────────────────────────────────────────────────
export const getConversation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [messages] = await pool.execute(
            'SELECT * FROM tutor_messages WHERE conversation_id = ? ORDER BY created_at ASC',
            [id]
        );
        res.json(messages);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  sendMessage
//
//  Handles messages sent from the frontend.
//
//  IMPORTANT CHANGE: only role === 'user' triggers a model inference call.
//  Previously the controller called the AI for every message role (including
//  'system'), which caused two sequential model invocations per explanation
//  and effectively doubled the wait time on slow local hardware.
//
//  The frontend now sends all structured context fields in one request:
//    question_text, answer_options, user_selected_answer,
//    verified_correct_answer, source_explanation
//  These are forwarded directly to FastAPI so it can build a rich system prompt.
// ─────────────────────────────────────────────────────────────────────────────
export const sendMessage = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const {
            role,
            content,
            history,
            // Structured quiz context — sent by the frontend on the first user turn
            question_text,
            answer_options,
            user_selected_answer,
            verified_correct_answer,
            source_explanation,
        } = req.body;

        if (!content || !role) {
            return res.status(400).json({ error: 'Role and content are required.' });
        }

        await connection.beginTransaction();

        // Persist the incoming message
        const userMsgId = uuidv4();
        await connection.execute(
            'INSERT INTO tutor_messages (id, conversation_id, role, message_text) VALUES (?, ?, ?, ?)',
            [userMsgId, id, role, content]
        );

        // ── Only call the AI for user messages ────────────────────────────────
        // System/assistant messages are stored but don't trigger inference.
        // This eliminates the double-call that caused the SYNTHESIZING hang.
        if (role !== 'user') {
            await connection.commit();
            return res.json({ role, content, stored: true });
        }

        // ── Forward to FastAPI ────────────────────────────────────────────────
        const requestStart = Date.now();
        console.log(`[Tutor] → FastAPI request for conversation ${id}`);

        const payload = {
            // Structured fields — populate from structured context when available,
            // fall back to sensible defaults so FastAPI always gets a valid schema.
            question_text:           question_text           || 'Unknown question',
            answer_options:          Array.isArray(answer_options) ? answer_options : [],
            user_selected_answer:    user_selected_answer    || null,
            verified_correct_answer: verified_correct_answer || null,
            source_explanation:      source_explanation      || null,
            conversation_history:    Array.isArray(history)  ? history : [],
            // The user's actual message text triggers the follow-up path in FastAPI
            follow_up_question:      content,
        };

        let aiResponse;
        try {
            aiResponse = await fetch(TUTOR_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                // 3-minute hard timeout — local models can be slow
                signal: AbortSignal.timeout(180_000),
            });
        } catch (fetchErr) {
            const msg = fetchErr.name === 'TimeoutError'
                ? 'The AI Tutor took too long to respond. The model may be overloaded — please retry.'
                : `Could not connect to the AI Tutor service at ${TUTOR_API_URL}. Ensure the AI service is running.`;
            console.error(`[Tutor] fetch error (${Date.now() - requestStart}ms):`, fetchErr.message);
            await connection.rollback();
            return res.status(503).json({ error: msg });
        }

        const elapsed = Date.now() - requestStart;

        if (!aiResponse.ok) {
            let detail = aiResponse.statusText;
            try {
                const errBody = await aiResponse.json();
                detail = errBody.detail || errBody.error || detail;
            } catch (_) { /* ignore parse error */ }

            console.error(`[Tutor] FastAPI ${aiResponse.status} after ${elapsed}ms: ${detail}`);
            await connection.rollback();

            if (aiResponse.status === 503) {
                return res.status(503).json({
                    error: 'The AI model is currently unavailable or still loading. Please wait a moment and retry.',
                });
            }
            return res.status(502).json({
                error: `AI Tutor service error (${aiResponse.status}): ${detail}`,
            });
        }

        let data;
        try {
            data = await aiResponse.json();
        } catch (jsonErr) {
            console.error(`[Tutor] JSON parse error after ${elapsed}ms:`, jsonErr.message);
            await connection.rollback();
            return res.status(502).json({ error: 'Invalid JSON received from AI Tutor service.' });
        }

        // FastAPI TutorResponse schema: { role: "assistant", content: "..." }
        const aiContent = data.content;

        if (!aiContent || typeof aiContent !== 'string' || !aiContent.trim()) {
            console.error(`[Tutor] Empty content after ${elapsed}ms. Raw response:`, JSON.stringify(data).slice(0, 200));
            await connection.rollback();
            return res.status(502).json({ error: 'The AI Tutor returned an empty explanation. Please retry.' });
        }

        console.log(`[Tutor] ✓ response received in ${elapsed}ms (${aiContent.length} chars)`);

        // Persist the assistant reply
        const aiMsgId = uuidv4();
        await connection.execute(
            'INSERT INTO tutor_messages (id, conversation_id, role, message_text) VALUES (?, ?, ?, ?)',
            [aiMsgId, id, 'assistant', aiContent]
        );

        await connection.commit();
        res.json({ role: 'assistant', content: aiContent });

    } catch (err) {
        await connection.rollback();
        console.error('[Tutor] Unexpected error in sendMessage:', err.message);
        res.status(500).json({
            error: err.message || 'An unexpected error occurred while communicating with the AI Tutor.',
        });
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  generateQuiz  (unchanged logic, improved error handling)
// ─────────────────────────────────────────────────────────────────────────────
export const generateQuiz = async (req, res, next) => {
    try {
        const GENERATE_API_URL = TUTOR_API_URL.replace('/chat', '/generate');
        const payload = req.body;

        const response = await fetch(GENERATE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(180_000),
        });

        if (!response.ok) {
            if (response.status === 503) {
                throw new Error('The AI service is currently unavailable or still loading.');
            }
            const errData = await response.json().catch(() => ({}));
            throw new Error(`AI generation error: ${errData.detail || response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('[Tutor] Quiz generation error:', err.message);
        res.status(500).json({ error: err.message || 'An unexpected error occurred during AI generation.' });
    }
};
