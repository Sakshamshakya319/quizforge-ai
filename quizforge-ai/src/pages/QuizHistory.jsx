import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../services/api';
import {
  Clock, Trophy, ArrowRight, BookOpen,
  Play, Pause, Loader2, RefreshCw, AlertTriangle,
  RotateCcw, ChevronDown, ChevronUp, History, CheckCircle2,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  StatusBadge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
        <Trophy className="h-3 w-3 mr-1" /> Completed
      </span>
    );
  }
  if (status === 'paused') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        <Pause className="h-3 w-3 mr-1" /> Paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
      <Play className="h-3 w-3 mr-1" /> In Progress
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ResumeButton — transitions attempt to in_progress then navigates
// ─────────────────────────────────────────────────────────────────────────────
function ResumeButton({ attempt }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleResume = async () => {
    setBusy(true);
    setErr('');
    try {
      await fetchApi(`/attempts/${attempt.id}/resume`, { method: 'PATCH' });
      navigate(`/quiz/${attempt.quiz_id}`);
    } catch (e) {
      setErr(e.message || 'Could not resume. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleResume}
        disabled={busy}
        className="inline-flex items-center px-4 py-2 bg-amber-500 text-white text-xs font-semibold rounded-md hover:bg-amber-600 disabled:opacity-60 transition shadow-sm"
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Resuming…
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
            Resume Quiz
          </>
        )}
      </button>
      {err && <p className="text-[10px] text-destructive max-w-[160px] text-right">{err}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main QuizHistory component
// ─────────────────────────────────────────────────────────────────────────────
export default function QuizHistory() {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedQuizzes, setExpandedQuizzes] = useState({});

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchApi('/attempts/history');
      setHistory(data);
    } catch (err) {
      setError('Failed to load quiz history.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const toggleExpand = (quizId) => {
    setExpandedQuizzes(prev => ({
      ...prev,
      [quizId]: !prev[quizId]
    }));
  };

  // ── Group attempts by quiz_id ──────────────────────────────────────────────
  const quizGroups = useMemo(() => {
    const groups = new Map();

    for (const attempt of history) {
      if (!groups.has(attempt.quiz_id)) {
        groups.set(attempt.quiz_id, {
          quizId: attempt.quiz_id,
          quizTitle: attempt.quiz_title,
          totalQuestions: attempt.quiz_question_count || attempt.total_questions || 0,
          activeAttempt: null,
          completedAttempts: [],
        });
      }

      const g = groups.get(attempt.quiz_id);

      if (attempt.status === 'in_progress' || attempt.status === 'paused') {
        // Enforce exactly one active attempt in the UI group (topmost sorted by backend)
        if (!g.activeAttempt) {
          g.activeAttempt = attempt;
        }
      } else if (attempt.status === 'completed') {
        g.completedAttempts.push(attempt);
      }
    }

    return Array.from(groups.values());
  }, [history]);

  // ── Guard renders ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading history…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive space-y-3">
        <AlertTriangle className="h-8 w-8 mx-auto opacity-70" />
        <p>{error}</p>
        <button
          onClick={loadHistory}
          className="inline-flex items-center px-4 py-2 bg-secondary text-foreground rounded-md hover:bg-border transition font-medium text-sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </button>
      </div>
    );
  }

  if (quizGroups.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-20 text-muted-foreground" />
        <h3 className="text-lg font-medium text-foreground mb-2">No History Yet</h3>
        <p className="text-muted-foreground mb-6">
          You haven't attempted any quizzes yet. Start a quiz to see your history here.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition shadow-sm"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  // ── Render grouped quiz history ────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Quiz History</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track your ongoing progress and review completed assessments.
          </p>
        </div>
        <button
          onClick={loadHistory}
          className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition px-3 py-1.5 rounded-md hover:bg-secondary border border-border/60"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
        </button>
      </div>

      <div className="space-y-6">
        {quizGroups.map(group => {
          const active = group.activeAttempt;
          const completed = group.completedAttempts;
          const isExpanded = !!expandedQuizzes[group.quizId];
          const latestCompleted = completed.length > 0 ? completed[0] : null;

          return (
            <div
              key={group.quizId}
              className="bg-card border border-border rounded-xl shadow-sm overflow-hidden transition hover:border-border/80"
            >
              {/* ── Quiz Header ─────────────────────────────────────────── */}
              <div className="px-6 py-4 bg-secondary/30 border-b border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-foreground truncate" title={group.quizTitle}>
                      {group.quizTitle}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{group.totalQuestions} Questions</span>
                      {completed.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{completed.length} completed attempt{completed.length > 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {active ? (
                    <StatusBadge status={active.status} />
                  ) : latestCompleted ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                      Completed
                    </span>
                  ) : null}
                </div>
              </div>

              {/* ── Current Active Attempt Section ──────────────────────── */}
              {active && (
                <div className="p-6 bg-amber-50/20 border-b border-border">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                          Current Attempt
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Started {formatTime(active.started_at)}
                        </span>
                      </div>

                      {/* Progress bar calculation */}
                      {(() => {
                        const total = group.totalQuestions || active.total_questions || 0;
                        const answered = typeof active.answered_count === 'number'
                          ? active.answered_count
                          : 0;
                        const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

                        return (
                          <div className="space-y-1.5 max-w-md">
                            <div className="flex justify-between text-xs font-medium text-foreground">
                              <span>
                                {answered} / {total} questions answered
                              </span>
                              <span>{pct}%</span>
                            </div>
                            <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {active.last_saved_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last saved: {formatTime(active.last_saved_at)}
                          </span>
                        )}
                        {active.elapsed_seconds > 0 && (
                          <span>Time spent: {formatElapsed(active.elapsed_seconds)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <ResumeButton attempt={active} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── No Active Attempt but has Completed Attempt Section ─── */}
              {!active && latestCompleted && (
                <div className="p-6 bg-card border-b border-border">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                          Latest Result
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Completed {formatTime(latestCompleted.completed_at || latestCompleted.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-bold ${
                          latestCompleted.score_percentage >= 80
                            ? 'text-emerald-600'
                            : latestCompleted.score_percentage >= 60
                            ? 'text-amber-600'
                            : 'text-destructive'
                        }`}>
                          {Math.round(latestCompleted.score_percentage || 0)}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({latestCompleted.correct_count ?? 0} of {latestCompleted.verified_questions_count ?? 0} verified correct)
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Duration: {formatElapsed(latestCompleted.duration_seconds)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        to={`/results/${group.quizId}/${latestCompleted.id}`}
                        className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition shadow-sm"
                      >
                        View Results <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Link>

                      <Link
                        to={`/quiz/${group.quizId}?forceNew=true`}
                        className="inline-flex items-center px-4 py-2 bg-secondary text-foreground text-xs font-semibold rounded-md hover:bg-border transition border border-border"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Start New Attempt
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Expandable Past Attempts Toggle / History Table ─────── */}
              {completed.length > 0 && (
                <div className="px-6 py-3 bg-secondary/20 flex flex-col">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleExpand(group.quizId)}
                      className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition py-1 focus:outline-none"
                    >
                      <History className="h-3.5 w-3.5 mr-1.5" />
                      {isExpanded ? 'Hide' : 'View'} Past Attempts ({completed.length})
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-1" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      )}
                    </button>

                    {active && (
                      <Link
                        to={`/quiz/${group.quizId}?forceNew=true`}
                        className="text-xs text-muted-foreground hover:text-foreground underline transition"
                        title="Abandon current active attempt and start from question 1"
                      >
                        Start Fresh Attempt
                      </Link>
                    )}
                  </div>

                  {/* Expanded table */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border overflow-x-auto animate-in fade-in duration-200">
                      <table className="w-full text-xs text-left">
                        <thead className="text-[11px] text-muted-foreground uppercase bg-secondary/50 border-b border-border">
                          <tr>
                            <th className="px-4 py-2 font-semibold">Completed Date</th>
                            <th className="px-4 py-2 font-semibold">Score</th>
                            <th className="px-4 py-2 font-semibold">Correct / Total</th>
                            <th className="px-4 py-2 font-semibold">Duration</th>
                            <th className="px-4 py-2 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {completed.map(att => (
                            <tr key={att.id} className="hover:bg-secondary/40 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-foreground">
                                {formatTime(att.completed_at || att.created_at)}
                              </td>
                              <td className="px-4 py-2.5 font-bold">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  att.score_percentage >= 80
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : att.score_percentage >= 60
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-destructive/10 text-destructive'
                                }`}>
                                  {Math.round(att.score_percentage || 0)}%
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {att.correct_count ?? 0} / {att.verified_questions_count ?? 0}
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {formatElapsed(att.duration_seconds)}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Link
                                  to={`/results/${group.quizId}/${att.id}`}
                                  className="inline-flex items-center text-primary font-medium hover:underline"
                                >
                                  View Results <ArrowRight className="h-3 w-3 ml-1" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
