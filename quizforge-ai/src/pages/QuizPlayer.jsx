import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { fetchApi, API_BASE_URL } from '../services/api';
import {
  CheckCircle2, XCircle, Bot, Loader2, Send,
  Library, AlertTriangle, RefreshCw, Pause,
  Flag, FlagOff, Clock, CloudOff, Cloud, CheckCheck,
} from 'lucide-react';
import { explainIncorrectAnswer, chatWithTutor } from '../services/aiTutor';

// ─────────────────────────────────────────────────────────────────────────────
//  AI panel states
// ─────────────────────────────────────────────────────────────────────────────
const AI_STATE = {
  IDLE:      'idle',
  LOADING:   'loading',
  SUCCESS:   'success',
  ERROR:     'error',
  TIMEOUT:   'timeout',
  CANCELLED: 'cancelled',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Autosave status visible in the header
// ─────────────────────────────────────────────────────────────────────────────
const SAVE_STATUS = {
  IDLE:   'idle',    // nothing pending
  SAVING: 'saving',  // request in flight
  SAVED:  'saved',   // confirmed by backend
  ERROR:  'error',   // last save failed
};

export default function QuizPlayer() {
  const { quizId }  = useParams();
  const navigate    = useNavigate();

  // ── Quiz / attempt data ───────────────────────────────────────────────────
  const [quiz,      setQuiz]      = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attemptId, setAttemptId] = useState(null);

  // ── Navigation & answer state ─────────────────────────────────────────────
  const [currentIndex,    setCurrentIndex]    = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { questionId: optionId }
  const [isSubmitted,     setIsSubmitted]     = useState({}); // { questionId: true }
  const [flagged,         setFlagged]         = useState({}); // { questionId: true }

  // ── Elapsed time (seconds) ────────────────────────────────────────────────
  // startTimeRef holds the epoch-ms at which the current "active" session began.
  // elapsedBaseRef is the seconds already accumulated from previous sessions.
  const startTimeRef   = useRef(Date.now());
  const elapsedBaseRef = useRef(0);

  // ── Pause state ───────────────────────────────────────────────────────────
  const [isPausing,    setIsPausing]    = useState(false);
  const [pauseError,   setPauseError]   = useState('');

  // ── Autosave status ───────────────────────────────────────────────────────
  const [saveStatus,   setSaveStatus]   = useState(SAVE_STATUS.IDLE);
  const [lastSavedAt,  setLastSavedAt]  = useState(null); // Date object

  // A ref that holds the latest selectedAnswers + flagged without causing
  // stale closures in the beforeunload / visibilitychange handlers.
  const liveStateRef = useRef({ selectedAnswers: {}, flagged: {}, currentIndex: 0, attemptId: null });

  // ── AI panel state ────────────────────────────────────────────────────────
  const [aiPanels,     setAiPanels]     = useState({});
  const [chatHistory,  setChatHistory]  = useState({});
  const [chatInput,    setChatInput]    = useState('');
  const [isChatSending,setIsChatSending]= useState(false);

  const location    = useLocation();
  const loadInFlightRef = useRef(false);

  // ── Page state ────────────────────────────────────────────────────────────
  const [isLoading,    setIsLoading]    = useState(true);
  const [notFound,     setNotFound]     = useState(false);

  const abortRef = useRef(null); // AI request cancellation

  // ─────────────────────────────────────────────────────────────────────────
  //  Keep liveStateRef in sync so event handlers always see current values
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    liveStateRef.current = { selectedAnswers, flagged, currentIndex, attemptId };
  }, [selectedAnswers, flagged, currentIndex, attemptId]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Elapsed-seconds helper — reads from base + current session
  // ─────────────────────────────────────────────────────────────────────────
  const getElapsed = useCallback(() => {
    const sessionSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    return elapsedBaseRef.current + sessionSeconds;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  Load quiz on mount — check for a resumable attempt first
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    const loadQuiz = async () => {
      try {
        const [q, qs] = await Promise.all([
          fetchApi(`/quizzes/${quizId}`),
          fetchApi(`/quizzes/${quizId}/questions`),
        ]);
        setQuiz(q);
        setQuestions(qs);

        const forceNew = new URLSearchParams(location.search).get('forceNew') === 'true';

        // Check for an existing paused / in-progress attempt to resume
        let attempt = null;
        if (!forceNew) {
          try {
            attempt = await fetchApi(`/attempts/quiz/${quizId}/in-progress`);
          } catch (e) {
            // 404 means no resumable attempt — start fresh below
            if (!e.message?.includes('404') && !e.message?.toLowerCase().includes('not found')) {
              throw e;
            }
          }
        }

        if (attempt) {
          // ── Restore paused / in-progress attempt ──────────────────────────
          const resumed = await fetchApi(`/attempts/${attempt.id}/resume`, { method: 'PATCH' });

          setAttemptId(resumed.id);
          elapsedBaseRef.current = resumed.elapsed_seconds || 0;
          startTimeRef.current   = Date.now();

          const savedIndex = resumed.current_question_index ?? 0;
          setCurrentIndex(Math.min(savedIndex, qs.length - 1));

          if (Array.isArray(resumed.answers)) {
            const restoredAnswers = {};
            const restoredFlags   = {};
            for (const a of resumed.answers) {
              if (a.selected_option_id) {
                restoredAnswers[a.question_id] = a.selected_option_id;
              }
              if (a.is_flagged) {
                restoredFlags[a.question_id] = true;
              }
            }
            setSelectedAnswers(restoredAnswers);
            setFlagged(restoredFlags);
          }

          if (resumed.last_saved_at) {
            setLastSavedAt(new Date(resumed.last_saved_at));
          }
        } else {
          // ── Start attempt (idempotently returns existing active or creates new) ───
          const att = await fetchApi(`/attempts/quiz/${quizId}`, {
            method: 'POST',
            body: JSON.stringify({ forceNew }),
          });
          setAttemptId(att.id);

          if (att.isExisting) {
            elapsedBaseRef.current = att.elapsed_seconds || 0;
            startTimeRef.current   = Date.now();
            const savedIndex = att.current_question_index ?? 0;
            setCurrentIndex(Math.min(savedIndex, qs.length - 1));

            if (Array.isArray(att.answers)) {
              const restoredAnswers = {};
              const restoredFlags   = {};
              for (const a of att.answers) {
                if (a.selected_option_id) {
                  restoredAnswers[a.question_id] = a.selected_option_id;
                }
                if (a.is_flagged) {
                  restoredFlags[a.question_id] = true;
                }
              }
              setSelectedAnswers(restoredAnswers);
              setFlagged(restoredFlags);
            }

            if (att.last_saved_at) {
              setLastSavedAt(new Date(att.last_saved_at));
            }
          } else {
            startTimeRef.current = Date.now();
          }
        }
      } catch (err) {
        console.error('QuizPlayer load error:', err);
        if (err.message?.includes('404') || err.message?.toLowerCase().includes('not found')) {
          setNotFound(true);
        } else {
          navigate('/');
        }
      } finally {
        setIsLoading(false);
        loadInFlightRef.current = false;
      }
    };

    loadQuiz();
    return () => {
      loadInFlightRef.current = false;
      abortRef.current?.abort();
    };
  }, [quizId, navigate, location.search]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Page-visibility autosave: fire a pause when user hides the tab
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const { selectedAnswers: sa, flagged: fl, currentIndex: ci, attemptId: aid } = liveStateRef.current;
        if (!aid) return;
        const answersPayload = buildAnswersPayload(sa, fl);
        const payload = JSON.stringify({
          current_question_index: ci,
          elapsed_seconds: getElapsed(),
          answers: answersPayload,
        });
        navigator.sendBeacon(
          `${API_BASE_URL}/attempts/${aid}/pause`,
          new Blob([payload], { type: 'application/json' })
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [getElapsed]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Cancel AI request when question changes
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, [currentIndex]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────────────────────────────────
  const buildAnswersPayload = (sa, fl) => {
    // Merge selected answers and flags into a unified array for the backend
    const all = new Set([...Object.keys(sa), ...Object.keys(fl)]);
    return Array.from(all).map(qId => ({
      question_id:        qId,
      selected_option_id: sa[qId] || null,
      is_flagged:         fl[qId] ? 1 : 0,
    }));
  };

  const setPanelState = useCallback((qId, patch) => {
    setAiPanels(prev => ({ ...prev, [qId]: { ...(prev[qId] || {}), ...patch } }));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  Autosave a single answer immediately after selection
  // ─────────────────────────────────────────────────────────────────────────
  const autosaveAnswer = useCallback(async (aid, questionId, optionId, isFlagged) => {
    if (!aid) return;
    setSaveStatus(SAVE_STATUS.SAVING);
    try {
      await fetchApi(`/attempts/${aid}/answers/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify({
          selected_option_id: optionId,
          is_flagged: isFlagged ? 1 : 0,
        }),
      });
      setSaveStatus(SAVE_STATUS.SAVED);
      setLastSavedAt(new Date());
      // Reset back to IDLE after 3 s so the "Saved" indicator fades
      setTimeout(() => setSaveStatus(s => s === SAVE_STATUS.SAVED ? SAVE_STATUS.IDLE : s), 3000);
    } catch {
      setSaveStatus(SAVE_STATUS.ERROR);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  Answer selection
  // ─────────────────────────────────────────────────────────────────────────
  const handleSelect = (optionId) => {
    const q = questions[currentIndex];
    if (isSubmitted[q.id] || isPausing) return;
    setSelectedAnswers(prev => ({ ...prev, [q.id]: optionId }));
    autosaveAnswer(attemptId, q.id, optionId, flagged[q.id] ?? false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Flag toggle
  // ─────────────────────────────────────────────────────────────────────────
  const handleToggleFlag = () => {
    const q = questions[currentIndex];
    const newFlagged = !flagged[q.id];
    setFlagged(prev => ({ ...prev, [q.id]: newFlagged }));
    // Persist the flag (answer may or may not exist yet)
    if (attemptId) {
      fetchApi(`/attempts/${attemptId}/answers/${q.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          selected_option_id: selectedAnswers[q.id] || null,
          is_flagged: newFlagged ? 1 : 0,
        }),
      }).catch(() => {/* best-effort — flag will be saved on next pause */});
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Confirm Answer
  // ─────────────────────────────────────────────────────────────────────────
  const handleSubmitQuestion = () => {
    const q = questions[currentIndex];
    if (!selectedAnswers[q.id]) return;
    setIsSubmitted(prev => ({ ...prev, [q.id]: true }));
    const isCorrect  = selectedAnswers[q.id] === q.correctOptionId;
    const isVerified = q.verificationStatus === 'verified';
    if (!isCorrect && isVerified) fetchAiExplanation(q, selectedAnswers[q.id]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Pause & Save
  // ─────────────────────────────────────────────────────────────────────────
  const handlePause = async () => {
    if (!attemptId || isPausing) return;
    setIsPausing(true);
    setPauseError('');

    const answersPayload = buildAnswersPayload(selectedAnswers, flagged);

    try {
      await fetchApi(`/attempts/${attemptId}/pause`, {
        method: 'PATCH',
        body: JSON.stringify({
          current_question_index: currentIndex,
          elapsed_seconds:        getElapsed(),
          answers:                answersPayload,
        }),
      });
      // Cancel any in-flight AI request before leaving
      abortRef.current?.abort();
      navigate('/history');
    } catch (err) {
      setPauseError(err.message || 'Could not save progress. Please retry.');
      setIsPausing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Finish (submit)
  // ─────────────────────────────────────────────────────────────────────────
  const handleFinishQuiz = async () => {
    try {
      await fetchApi(`/attempts/${attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ duration_seconds: getElapsed() }),
      });
      navigate(`/results/${quiz.id}/${attemptId}`);
    } catch {
      alert('Failed to submit quiz. Please try again.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  AI explanation
  // ─────────────────────────────────────────────────────────────────────────
  const fetchAiExplanation = useCallback(async (question, selectedOptId) => {
    const qId = question.id;
    if (aiPanels[qId]?.status === AI_STATE.SUCCESS) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPanelState(qId, { status: AI_STATE.LOADING, errorMsg: null });
    try {
      const result = await explainIncorrectAnswer(question, selectedOptId, attemptId, controller.signal);
      if (controller.signal.aborted) return;
      setPanelState(qId, { status: AI_STATE.SUCCESS, text: result.text, conversationId: result.conversationId, errorMsg: null });
      setChatHistory(prev => ({ ...prev, [qId]: [{ role: 'assistant', content: result.text }] }));
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err.message === 'TIMEOUT')  { setPanelState(qId, { status: AI_STATE.TIMEOUT,  errorMsg: 'The AI model took too long to respond.' }); return; }
      if (err.message === 'ABORTED')  { setPanelState(qId, { status: AI_STATE.CANCELLED }); return; }
      setPanelState(qId, { status: AI_STATE.ERROR, errorMsg: err.message || 'An unexpected error occurred.' });
    }
  }, [attemptId, aiPanels, setPanelState]);

  const handleRetryAi = () => {
    const q = questions[currentIndex];
    setPanelState(q.id, { status: AI_STATE.IDLE, text: null, errorMsg: null });
    fetchAiExplanation(q, selectedAnswers[q.id]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Follow-up chat
  // ─────────────────────────────────────────────────────────────────────────
  const handleSendChat = async () => {
    const q    = questions[currentIndex];
    const qId  = q.id;
    const panel = aiPanels[qId];
    if (!chatInput.trim() || isChatSending || !panel?.conversationId) return;
    const userMsg    = { role: 'user', content: chatInput };
    const history    = chatHistory[qId] || [];
    const newHistory = [...history, userMsg];
    setChatHistory(prev => ({ ...prev, [qId]: newHistory }));
    setChatInput('');
    setIsChatSending(true);
    try {
      const reply = await chatWithTutor(panel.conversationId, chatInput, newHistory);
      setChatHistory(prev => ({ ...prev, [qId]: [...newHistory, { role: 'assistant', content: reply }] }));
    } catch (err) {
      setChatHistory(prev => ({ ...prev, [qId]: [...newHistory, { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}` }] }));
    } finally {
      setIsChatSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Navigation
  // ─────────────────────────────────────────────────────────────────────────
  const handleNext     = () => { if (currentIndex < questions.length - 1) setCurrentIndex(p => p + 1); };
  const handlePrevious = () => { if (currentIndex > 0)                    setCurrentIndex(p => p - 1); };

  // ─────────────────────────────────────────────────────────────────────────
  //  Guard renders
  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) return <div className="p-12 text-center text-muted-foreground font-medium">Loading assessment…</div>;

  if (notFound) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Quiz Not Found</h2>
        <p className="text-muted-foreground mb-6">This quiz may have been deleted or the link is no longer valid.</p>
        <Link to="/quizzes" className="inline-flex items-center px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition shadow-sm">
          <Library className="h-4 w-4 mr-2" /> Back to My Quizzes
        </Link>
      </div>
    );
  }

  if (!quiz)             return <div className="p-12 text-center text-muted-foreground font-medium">Loading assessment…</div>;
  if (!questions.length) return <div className="p-12 text-center text-muted-foreground font-medium">No questions found.</div>;

  // ─────────────────────────────────────────────────────────────────────────
  //  Derived state
  // ─────────────────────────────────────────────────────────────────────────
  const currentQuestion  = questions[currentIndex];
  const hasAnswered      = !!selectedAnswers[currentQuestion.id];
  const hasSubmitted     = !!isSubmitted[currentQuestion.id];
  const selectedOptionId = selectedAnswers[currentQuestion.id];
  const isCorrect        = selectedOptionId === currentQuestion.correctOptionId;
  const isFlagged        = !!flagged[currentQuestion.id];
  const answeredCount    = Object.keys(selectedAnswers).length;
  const progress         = (answeredCount / questions.length) * 100;
  const panel            = aiPanels[currentQuestion.id] || { status: AI_STATE.IDLE };
  const panelMessages    = chatHistory[currentQuestion.id] || [];

  // Save-status badge
  const SaveBadge = () => {
    if (saveStatus === SAVE_STATUS.SAVING) return (
      <span className="flex items-center text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving…
      </span>
    );
    if (saveStatus === SAVE_STATUS.SAVED) return (
      <span className="flex items-center text-xs text-emerald-600">
        <CheckCheck className="h-3 w-3 mr-1" /> Saved
      </span>
    );
    if (saveStatus === SAVE_STATUS.ERROR) return (
      <span className="flex items-center text-xs text-destructive">
        <CloudOff className="h-3 w-3 mr-1" /> Save failed
      </span>
    );
    if (lastSavedAt) return (
      <span className="flex items-center text-xs text-muted-foreground">
        <Cloud className="h-3 w-3 mr-1" />
        Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-300">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Question {currentIndex + 1} of {questions.length}
          </div>
          <h2 className="text-xl font-bold text-foreground">{quiz.title}</h2>
          {/* Answered count + save badge */}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{answeredCount} of {questions.length} answered</span>
            <span className="text-border">|</span>
            <SaveBadge />
          </div>
        </div>

        {/* Pause & Save button */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <button
            onClick={handlePause}
            disabled={isPausing || !attemptId}
            className={`flex items-center px-4 py-2 font-medium rounded-md transition shadow-sm text-sm ${
              isPausing
                ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
            }`}
          >
            {isPausing
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              : <><Pause className="h-4 w-4 mr-2" />Pause & Save</>
            }
          </button>
          {pauseError && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-1.5 max-w-[220px] text-right">
              {pauseError}
              <button onClick={handlePause} className="ml-2 underline font-semibold">Retry</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress bar (based on answered count, not position) ── */}
      <div className="w-full bg-border rounded-full h-1 mb-8 overflow-hidden">
        <div
          className="bg-primary h-1 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* ── Question card ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl shadow-sm p-8">

            {/* Question number + flag */}
            <div className="flex items-start justify-between mb-5">
              <h3 className="text-lg font-semibold text-foreground leading-relaxed flex-1 mr-4">
                {currentQuestion.questionText}
              </h3>
              <button
                onClick={handleToggleFlag}
                title={isFlagged ? 'Remove flag' : 'Flag for review'}
                className={`flex-shrink-0 p-1.5 rounded-md transition ${
                  isFlagged
                    ? 'text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                    : 'text-muted-foreground hover:text-amber-600 hover:bg-amber-50'
                }`}
              >
                {isFlagged ? <Flag className="h-4 w-4" /> : <FlagOff className="h-4 w-4" />}
              </button>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map(opt => {
                const isSelected = selectedOptionId === opt.id;
                let cls = 'border-border bg-card hover:border-primary/40 cursor-pointer';

                if (hasSubmitted) {
                  cls = 'border-border bg-secondary/30 opacity-70 cursor-default';
                  if (opt.id === currentQuestion.correctOptionId)
                    cls = 'border-emerald-500 bg-emerald-50/50 opacity-100 ring-1 ring-emerald-500 shadow-sm';
                  else if (isSelected && !isCorrect)
                    cls = 'border-destructive bg-destructive/5 opacity-100 ring-1 ring-destructive shadow-sm';
                } else if (isSelected) {
                  cls = 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm';
                }

                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelect(opt.id)}
                    className={`p-4 rounded-lg border transition-all flex items-start ${cls}`}
                  >
                    <div className="flex-shrink-0 w-8 flex items-center justify-center font-bold text-muted-foreground mt-0.5 text-sm">
                      {opt.label}.
                    </div>
                    <div className={`flex-1 ml-2 text-sm ${hasSubmitted && opt.id === currentQuestion.correctOptionId ? 'text-emerald-900 font-medium' : 'text-foreground'}`}>
                      {opt.text}
                    </div>
                    {hasSubmitted && opt.id === currentQuestion.correctOptionId && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 ml-2" />
                    )}
                    {hasSubmitted && isSelected && !isCorrect && opt.id === selectedOptionId && (
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0 ml-2" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Confirm / navigation controls */}
            {!hasSubmitted ? (
              <div className="mt-8 flex items-center justify-between">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 bg-card border border-border text-foreground font-medium rounded-md hover:bg-secondary disabled:opacity-40 transition text-sm"
                >
                  Previous
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSubmitQuestion}
                    disabled={!hasAnswered}
                    className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm text-sm"
                  >
                    Confirm Answer
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === questions.length - 1}
                    className="px-4 py-2 bg-card border border-border text-foreground font-medium rounded-md hover:bg-secondary disabled:opacity-40 transition text-sm"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex justify-between items-center border-t border-border pt-6">
                <div className="text-lg font-bold">
                  {isCorrect
                    ? <span className="text-emerald-600 flex items-center"><CheckCircle2 className="mr-2 h-5 w-5" /> Correct</span>
                    : <span className="text-destructive flex items-center"><XCircle className="mr-2 h-5 w-5" /> Incorrect</span>}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="px-4 py-2 bg-card border border-border text-foreground font-medium rounded-md hover:bg-secondary disabled:opacity-40 transition text-sm"
                  >
                    Previous
                  </button>
                  {currentIndex < questions.length - 1 ? (
                    <button
                      onClick={handleNext}
                      className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition shadow-sm text-sm"
                    >
                      Next Question
                    </button>
                  ) : (
                    <button
                      onClick={handleFinishQuiz}
                      className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 transition shadow-sm text-sm"
                    >
                      Finish Assessment
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Flagged-question hint */}
          {isFlagged && (
            <div className="flex items-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <Flag className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
              This question is flagged for review. Your flag will be saved when you pause.
            </div>
          )}
        </div>

        {/* ── AI Tutor panel ── */}
        <div className="lg:col-span-1">
          {hasSubmitted && !isCorrect && (
            <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col max-h-[620px] overflow-hidden">
              <div className="p-4 border-b border-border bg-primary/5 flex items-center">
                <Bot className="h-5 w-5 text-primary mr-2" />
                <h3 className="font-semibold text-foreground text-sm">AI Tutor Analysis</h3>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-4 text-sm">
                {currentQuestion.explanation && (
                  <div className="bg-secondary/50 p-4 rounded-md border border-border text-muted-foreground">
                    <span className="font-semibold text-foreground block mb-1">Source Context:</span>
                    {currentQuestion.explanation}
                  </div>
                )}

                {panel.status === AI_STATE.LOADING && (
                  <div className="flex flex-col items-center justify-center py-6 space-y-3">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Analysing your answer…</p>
                    <p className="text-xs text-muted-foreground text-center max-w-[180px]">Local AI inference can take up to a few minutes.</p>
                  </div>
                )}

                {panel.status === AI_STATE.SUCCESS && (
                  <div className="bg-secondary rounded-md border border-border p-3 text-foreground">
                    {panel.text}
                  </div>
                )}

                {panel.status === AI_STATE.SUCCESS && panelMessages.length > 1 &&
                  panelMessages.slice(1).map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-3 rounded-md max-w-[85%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-secondary text-foreground border border-border rounded-tl-none'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                }

                {isChatSending && (
                  <div className="flex items-start">
                    <div className="bg-secondary border border-border p-3 rounded-md flex items-center space-x-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs font-medium uppercase tracking-wider">Synthesizing…</span>
                    </div>
                  </div>
                )}

                {(panel.status === AI_STATE.ERROR || panel.status === AI_STATE.TIMEOUT) && (
                  <div className="flex flex-col items-center py-6 space-y-3 text-center">
                    <AlertTriangle className="h-8 w-8 text-amber-500" />
                    <p className="text-sm font-semibold text-foreground">
                      {panel.status === AI_STATE.TIMEOUT ? 'Analysis timed out' : 'Analysis failed'}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      {panel.errorMsg || 'An error occurred. Please retry.'}
                    </p>
                    <button
                      onClick={handleRetryAi}
                      className="flex items-center px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 transition shadow-sm"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Analysis
                    </button>
                  </div>
                )}

                {panel.status === AI_STATE.IDLE && (
                  <div className="flex flex-col items-center justify-center py-6 space-y-2">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    <p className="text-xs text-muted-foreground">Starting analysis…</p>
                  </div>
                )}
              </div>

              {panel.status === AI_STATE.SUCCESS && (
                <div className="p-4 border-t border-border bg-card">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                      placeholder="Ask for clarification…"
                      className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={isChatSending || !chatInput.trim()}
                      className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
