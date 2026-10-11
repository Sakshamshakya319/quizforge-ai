import { pool } from '../server/config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { initAttemptSchemaAndReconcile } from '../server/services/reconciliationService.js';

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING ATTEMPT LIFECYCLE & DUPLICATE PREVENTION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  // Helper to make API calls
  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, ok: res.ok, data };
  }

  // 1. Setup a dedicated temporary test quiz with 3 questions
  const testQuizId = uuidv4();
  const q1Id = uuidv4();
  const q2Id = uuidv4();
  const q3Id = uuidv4();
  const opt1A = uuidv4();
  const opt1B = uuidv4();
  const opt2A = uuidv4();
  const opt2B = uuidv4();
  const opt3A = uuidv4();
  const opt3B = uuidv4();

  try {
    // Ensure schema is prepared
    await initAttemptSchemaAndReconcile();

    // Insert test quiz
    await pool.execute(
      'INSERT INTO quizzes (id, title, description) VALUES (?, ?, ?)',
      [testQuizId, 'Lifecycle Test Quiz', 'Automated testing quiz']
    );

    // Insert 3 test questions
    await pool.execute(
      'INSERT INTO questions (id, quiz_id, question_text, question_order, verification_status) VALUES (?, ?, ?, ?, ?)',
      [q1Id, testQuizId, 'Test Question 1', 0, 'verified']
    );
    await pool.execute(
      'INSERT INTO question_options (id, question_id, option_label, option_text, is_correct, option_order) VALUES (?, ?, ?, ?, ?, ?)',
      [opt1A, q1Id, 'A', 'Option 1A Correct', 1, 0]
    );
    await pool.execute(
      'INSERT INTO question_options (id, question_id, option_label, option_text, is_correct, option_order) VALUES (?, ?, ?, ?, ?, ?)',
      [opt1B, q1Id, 'B', 'Option 1B Wrong', 0, 1]
    );

    await pool.execute(
      'INSERT INTO questions (id, quiz_id, question_text, question_order, verification_status) VALUES (?, ?, ?, ?, ?)',
      [q2Id, testQuizId, 'Test Question 2', 1, 'verified']
    );
    await pool.execute(
      'INSERT INTO question_options (id, question_id, option_label, option_text, is_correct, option_order) VALUES (?, ?, ?, ?, ?, ?)',
      [opt2A, q2Id, 'A', 'Option 2A Wrong', 0, 0]
    );
    await pool.execute(
      'INSERT INTO question_options (id, question_id, option_label, option_text, is_correct, option_order) VALUES (?, ?, ?, ?, ?, ?)',
      [opt2B, q2Id, 'B', 'Option 2B Correct', 1, 1]
    );

    await pool.execute(
      'INSERT INTO questions (id, quiz_id, question_text, question_order, verification_status) VALUES (?, ?, ?, ?, ?)',
      [q3Id, testQuizId, 'Test Question 3', 2, 'verified']
    );
    await pool.execute(
      'INSERT INTO question_options (id, question_id, option_label, option_text, is_correct, option_order) VALUES (?, ?, ?, ?, ?, ?)',
      [opt3A, q3Id, 'A', 'Option 3A Correct', 1, 0]
    );
    await pool.execute(
      'INSERT INTO question_options (id, question_id, option_label, option_text, is_correct, option_order) VALUES (?, ?, ?, ?, ?, ?)',
      [opt3B, q3Id, 'B', 'Option 3B Wrong', 0, 1]
    );

    console.log('Created test quiz:', testQuizId);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Starting a quiz with no active attempt creates exactly one attempt
    // ─────────────────────────────────────────────────────────────────────────
    const startRes1 = await api(`/attempts/quiz/${testQuizId}`, { method: 'POST' });
    assert(
      startRes1.status === 201 && startRes1.data.id && startRes1.data.status === 'in_progress',
      'Test 1: Starting quiz creates exactly one in_progress attempt',
      JSON.stringify(startRes1.data)
    );
    const firstAttemptId = startRes1.data.id;

    // Check DB count for this quiz
    const [dbAttempts1] = await pool.execute(
      'SELECT id, status FROM quiz_attempts WHERE quiz_id = ?',
      [testQuizId]
    );
    assert(
      dbAttempts1.length === 1 && dbAttempts1[0].id === firstAttemptId,
      'Test 1 (DB check): Exactly 1 row in quiz_attempts'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Starting the same quiz again returns the existing active attempt
    // ─────────────────────────────────────────────────────────────────────────
    const startRes2 = await api(`/attempts/quiz/${testQuizId}`, { method: 'POST' });
    assert(
      startRes2.status === 200 && startRes2.data.id === firstAttemptId && startRes2.data.isExisting === true,
      'Test 2: Starting again returns existing active attempt with same ID',
      JSON.stringify(startRes2.data)
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Concurrent start requests do not create multiple active attempts
    // ─────────────────────────────────────────────────────────────────────────
    const concurrentStarts = await Promise.all([
      api(`/attempts/quiz/${testQuizId}`, { method: 'POST' }),
      api(`/attempts/quiz/${testQuizId}`, { method: 'POST' }),
      api(`/attempts/quiz/${testQuizId}`, { method: 'POST' }),
      api(`/attempts/quiz/${testQuizId}`, { method: 'POST' }),
      api(`/attempts/quiz/${testQuizId}`, { method: 'POST' }),
    ]);
    const allSameId = concurrentStarts.every(
      r => (r.status === 200 || r.status === 201) && r.data.id === firstAttemptId
    );
    assert(
      allSameId,
      'Test 3: 5 concurrent start requests all return the exact same attempt ID'
    );

    const [dbAttemptsConcurrent] = await pool.execute(
      'SELECT id FROM quiz_attempts WHERE quiz_id = ?',
      [testQuizId]
    );
    assert(
      dbAttemptsConcurrent.length === 1,
      'Test 3 (DB check): Still exactly 1 row in quiz_attempts'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Saving an answer and pausing updates attempt, preserves same ID
    // ─────────────────────────────────────────────────────────────────────────
    await api(`/attempts/${firstAttemptId}/answers/${q1Id}`, {
      method: 'PUT',
      body: JSON.stringify({ selected_option_id: opt1A, is_flagged: 1 }),
    });

    const pauseRes = await api(`/attempts/${firstAttemptId}/pause`, {
      method: 'PATCH',
      body: JSON.stringify({
        current_question_index: 1,
        elapsed_seconds: 45,
        answers: [{ question_id: q1Id, selected_option_id: opt1A, is_flagged: 1 }],
      }),
    });
    assert(
      pauseRes.status === 200 && pauseRes.data.attempt.status === 'paused' && pauseRes.data.attempt.id === firstAttemptId,
      'Test 4: Pause & Save updates status to paused without creating a new attempt'
    );

    const [dbAttemptsPause] = await pool.execute(
      'SELECT id, status, current_question_index, elapsed_seconds FROM quiz_attempts WHERE quiz_id = ?',
      [testQuizId]
    );
    assert(
      dbAttemptsPause.length === 1 &&
      dbAttemptsPause[0].status === 'paused' &&
      dbAttemptsPause[0].current_question_index === 1 &&
      dbAttemptsPause[0].elapsed_seconds === 45,
      'Test 4 (DB check): Attempt is paused with saved index=1 and elapsed=45s'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: GET /in-progress returns the paused attempt
    // ─────────────────────────────────────────────────────────────────────────
    const inProgRes = await api(`/attempts/quiz/${testQuizId}/in-progress`);
    assert(
      inProgRes.status === 200 && inProgRes.data.id === firstAttemptId && inProgRes.data.status === 'paused',
      'Test 5: GET /in-progress returns paused attempt'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Resuming a paused attempt keeps the same attempt ID
    // ─────────────────────────────────────────────────────────────────────────
    const resumeRes = await api(`/attempts/${firstAttemptId}/resume`, { method: 'PATCH' });
    assert(
      resumeRes.status === 200 && resumeRes.data.id === firstAttemptId && resumeRes.data.status === 'in_progress',
      'Test 6: Resuming sets status=in_progress while keeping the same attempt ID'
    );

    // Resuming again is idempotent
    const resumeRes2 = await api(`/attempts/${firstAttemptId}/resume`, { method: 'PATCH' });
    assert(
      resumeRes2.status === 200 && resumeRes2.data.id === firstAttemptId,
      'Test 6b: Resuming an already in_progress attempt is idempotent'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Save second answer and verify distinct answered count in history
    // ─────────────────────────────────────────────────────────────────────────
    await api(`/attempts/${firstAttemptId}/answers/${q2Id}`, {
      method: 'PUT',
      body: JSON.stringify({ selected_option_id: opt2B }),
    });

    const historyRes1 = await api('/attempts/history');
    const historyItem1 = historyRes1.data.find(h => h.id === firstAttemptId);
    assert(
      historyItem1 && historyItem1.answered_count === 2,
      'Test 7: History calculates answered_count=2 distinct questions correctly',
      `got ${historyItem1?.answered_count}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Submitting the attempt computes verified score & sets completed
    // ─────────────────────────────────────────────────────────────────────────
    const submitRes = await api(`/attempts/${firstAttemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ duration_seconds: 90 }),
    });
    assert(
      submitRes.status === 200 && submitRes.data.score_percentage !== undefined,
      'Test 8: Submitting attempt succeeds',
      JSON.stringify(submitRes.data)
    );

    const [dbAttemptsSubmit] = await pool.execute(
      'SELECT id, status, score_percentage, correct_count, duration_seconds FROM quiz_attempts WHERE id = ?',
      [firstAttemptId]
    );
    assert(
      dbAttemptsSubmit.length === 1 &&
      dbAttemptsSubmit[0].status === 'completed' &&
      Number(dbAttemptsSubmit[0].correct_count) === 2,
      'Test 8 (DB check): Attempt is completed with correct score'
    );

    // Repeated submit is idempotent
    const submitRes2 = await api(`/attempts/${firstAttemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ duration_seconds: 90 }),
    });
    assert(
      submitRes2.status === 200 && submitRes2.data.isAlreadyCompleted === true,
      'Test 8b: Resubmitting completed attempt is idempotent and does not error'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 9: Starting the quiz again AFTER completion creates a NEW attempt
    // ─────────────────────────────────────────────────────────────────────────
    const startRes3 = await api(`/attempts/quiz/${testQuizId}`, { method: 'POST' });
    assert(
      startRes3.status === 201 && startRes3.data.id && startRes3.data.id !== firstAttemptId,
      'Test 9: Starting quiz after completion creates a new attempt (retrying quiz works)',
      `new id: ${startRes3.data.id}, old id: ${firstAttemptId}`
    );
    const secondAttemptId = startRes3.data.id;

    // Verify history now shows both attempts (completed and new in_progress)
    const historyRes2 = await api('/attempts/history');
    const quizAttemptsInHistory = historyRes2.data.filter(h => h.quiz_id === testQuizId);
    assert(
      quizAttemptsInHistory.length === 2,
      'Test 10: History retains both completed attempt and new active attempt',
      `found ${quizAttemptsInHistory.length} attempts`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 11: Database unique constraint blocks rogue duplicate active insertion
    // ─────────────────────────────────────────────────────────────────────────
    let dbBlocked = false;
    try {
      await pool.execute(
        'INSERT INTO quiz_attempts (id, quiz_id, user_id, status, total_questions) VALUES (?, ?, NULL, "in_progress", 3)',
        [uuidv4(), testQuizId]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        dbBlocked = true;
      }
    }
    assert(
      dbBlocked,
      'Test 11: Database level UNIQUE KEY uq_active_attempt blocks duplicate active attempt'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 12: forceNew flag cleanly supersedes previous active attempt
    // ─────────────────────────────────────────────────────────────────────────
    const forceNewRes = await api(`/attempts/quiz/${testQuizId}`, {
      method: 'POST',
      body: JSON.stringify({ forceNew: true }),
    });
    assert(
      forceNewRes.status === 201 && forceNewRes.data.id && forceNewRes.data.id !== secondAttemptId,
      'Test 12: forceNew creates a fresh attempt and abandons previous active attempt'
    );

    const [dbAbandoned] = await pool.execute(
      'SELECT status FROM quiz_attempts WHERE id = ?',
      [secondAttemptId]
    );
    assert(
      dbAbandoned[0].status === 'abandoned',
      'Test 12 (DB check): Previous active attempt marked as abandoned'
    );

    // Check history does not list abandoned attempts
    const historyRes3 = await api('/attempts/history');
    const abandonedInHistory = historyRes3.data.find(h => h.id === secondAttemptId);
    assert(
      !abandonedInHistory,
      'Test 12 (History check): Abandoned attempt excluded from user history view'
    );

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    // Cleanup temporary test quiz (CASCADE removes questions, options, attempts, answers)
    console.log('\nCleaning up test quiz...');
    await pool.execute('DELETE FROM quizzes WHERE id = ?', [testQuizId]);
    console.log('Cleanup finished.\n');

    console.log('====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed === 0 ? 0 : 1);
  }
}

runTests();
