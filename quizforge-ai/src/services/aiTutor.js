import { API_BASE_URL } from './api';

// ─────────────────────────────────────────────────────────────────────────────
//  In-memory explanation cache.
//  Key: `${questionId}:${correctOptionId}:${selectedOptionId}`
//  Value: { conversationId, text }
//
//  A cached entry is only reused when the question, correct answer, AND the
//  user's selected answer all match — so a second attempt with a different
//  wrong answer gets a fresh explanation.
// ─────────────────────────────────────────────────────────────────────────────
const explanationCache = new Map();

function cacheKey(questionId, correctOptionId, selectedOptionId) {
  return `${questionId}:${correctOptionId}:${selectedOptionId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  explainIncorrectAnswer
//
//  Called by QuizPlayer when the user submits a wrong answer.
//  Returns { conversationId, text } or throws with a human-readable message.
//
//  signal  — AbortSignal from the caller so navigation/retry can cancel inflight requests.
// ─────────────────────────────────────────────────────────────────────────────
export const explainIncorrectAnswer = async (question, selectedOptionId, attemptId, signal) => {
  // ── Resolve the options we need ───────────────────────────────────────────
  const correctOption  = question.options.find(o => o.id === question.correctOptionId);
  const selectedOption = question.options.find(o => o.id === selectedOptionId);

  if (!correctOption || !selectedOption) {
    throw new Error('Could not resolve answer options for AI explanation.');
  }

  // ── Return a cached result when the context matches ──────────────────────
  const key = cacheKey(question.id, question.correctOptionId, selectedOptionId);
  if (explanationCache.has(key)) {
    return explanationCache.get(key);
  }

  // ── Build structured fields — the backend forwards these directly to FastAPI
  const answerOptions = question.options.map(o => `${o.label}. ${o.text}`);
  const userSelected  = `${selectedOption.label}. ${selectedOption.text}`;
  const correctAnswer = `${correctOption.label}. ${correctOption.text}`;

  try {
    // ── Step 1: Create a conversation record in the DB ───────────────────────
    // This is a cheap DB insert, not a model call — no special timeout needed.
    const convRes = await fetchWithTimeout(
      `${API_BASE_URL}/tutor/conversations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempt_id: attemptId || null, question_id: question.id }),
        signal,
      },
      15_000   // 15 s for a DB round-trip
    );

    if (!convRes.ok) {
      const err = await convRes.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create conversation (${convRes.status})`);
    }

    const conv = await convRes.json();

    // ── Step 2: ONE model call with all structured context ───────────────────
    // We skip the separate "system message" call that the old code made — that
    // was what doubled the inference time.  The FastAPI /chat endpoint already
    // builds its own system prompt from the structured fields we provide here.
    const msgRes = await fetchWithTimeout(
      `${API_BASE_URL}/tutor/conversations/${conv.id}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          // A short trigger phrase — FastAPI will synthesize the full system
          // prompt from the structured fields below, so we don't duplicate info.
          content: 'Please explain this question and my answer.',
          // ── Structured context forwarded to FastAPI ──────────────────────
          question_text:           question.questionText,
          answer_options:          answerOptions,
          user_selected_answer:    userSelected,
          verified_correct_answer: correctAnswer,
          source_explanation:      question.explanation || null,
          history:                 [],   // empty — this is the first user turn
        }),
        signal,
      },
      180_000  // 3 min — local models are slow; don't cut them off prematurely
    );

    if (!msgRes.ok) {
      const err = await msgRes.json().catch(() => ({}));
      throw new Error(err.error || `AI Tutor request failed (${msgRes.status})`);
    }

    const data = await msgRes.json();
    const text = data.content;

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('The AI Tutor returned an empty explanation. Please retry.');
    }

    const result = { conversationId: conv.id, text };
    explanationCache.set(key, result);
    return result;

  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('ABORTED');
    }
    if (err.name === 'TimeoutError' || err.message === 'TIMEOUT') {
      throw new Error('TIMEOUT');
    }
    console.error('[aiTutor] explainIncorrectAnswer error:', err);
    throw new Error(err.message || 'Unable to reach the AI Tutor. Please check that the AI service is running and retry.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  chatWithTutor
//
//  Follow-up messages after the first explanation.
// ─────────────────────────────────────────────────────────────────────────────
export const chatWithTutor = async (conversationId, userText, history, signal) => {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/tutor/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content: userText,
          history,
        }),
        signal,
      },
      180_000
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI chat request failed (${res.status})`);
    }

    const data = await res.json();
    return data.content;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('ABORTED');
    if (err.name === 'TimeoutError' || err.message === 'TIMEOUT') throw new Error('TIMEOUT');
    console.error('[aiTutor] chatWithTutor error:', err);
    throw new Error(err.message || 'Unable to reach the AI Tutor.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  fetchWithTimeout
//
//  Wraps fetch with a hard deadline using AbortController.
//  Merges with any caller-supplied signal so both sources can cancel.
// ─────────────────────────────────────────────────────────────────────────────
function fetchWithTimeout(url, options = {}, timeoutMs = 60_000) {
  const timeoutController = new AbortController();
  const timerId = setTimeout(() => timeoutController.abort(new Error('TIMEOUT')), timeoutMs);

  // Merge caller signal with timeout signal
  const { signal: callerSignal, ...rest } = options;
  let mergedSignal = timeoutController.signal;

  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timerId);
      const err = new Error('AbortError');
      err.name = 'AbortError';
      return Promise.reject(err);
    }
    // Use AbortSignal.any when available (Node 20 / modern browsers), else manual
    if (typeof AbortSignal.any === 'function') {
      mergedSignal = AbortSignal.any([timeoutController.signal, callerSignal]);
    } else {
      callerSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
    }
  }

  return fetch(url, { ...rest, signal: mergedSignal }).finally(() => clearTimeout(timerId));
}
