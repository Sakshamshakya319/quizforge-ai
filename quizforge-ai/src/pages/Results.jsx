import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../services/api';
import { Trophy, XCircle, CheckCircle2, Download, ArrowLeft, RefreshCw, BarChart } from 'lucide-react';
import { generateReportPdf, generateQuizPdf } from '../utils/pdfGenerator';

export default function Results() {
  const { quizId, attemptId } = useParams();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attemptData, setAttemptData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadResults = async () => {
      try {
        const q = await fetchApi(`/quizzes/${quizId}`);
        const qs = await fetchApi(`/quizzes/${quizId}/questions`);
        const attemptRes = await fetchApi(`/attempts/${attemptId}/results`);
        
        setQuiz(q);
        setQuestions(qs);
        
        // Transform answers array to map
        const answersMap = {};
        attemptRes.answers.forEach(a => {
          answersMap[a.question_id] = a.selected_option_id;
        });
        
        setAttemptData({
          ...attemptRes.attempt,
          answers: answersMap,
          aiExplanations: attemptRes.aiExplanations
        });
      } catch (err) {
        console.error(err);
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };
    loadResults();
  }, [quizId, attemptId, navigate]);

  if (isLoading || !quiz || !attemptData) return <div className="p-12 text-center text-muted-foreground font-medium">Loading results...</div>;

  const percentage = attemptData.score_percentage || 0;
  const incorrectCount = attemptData.incorrect_count || 0;
  
  const formatTime = (seconds) => {
    if (!seconds) return 'N/A';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 text-primary rounded-full mb-2 shadow-sm border border-primary/20">
          <Trophy className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Assessment Complete</h1>
        <p className="text-muted-foreground text-lg">{quiz.title}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm text-center flex flex-col items-center justify-center">
          <div className="flex items-center space-x-2 mb-2 text-muted-foreground">
            <BarChart className="h-4 w-4" />
            <p className="text-sm font-medium uppercase tracking-wider">Final Score</p>
          </div>
          <p className="text-4xl font-bold text-foreground">{parseFloat(percentage).toFixed(0)}%</p>
          <p className="text-sm text-muted-foreground mt-2">{attemptData.correct_count} out of {attemptData.verified_questions_count} verified correct</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm text-center flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Duration</p>
          <p className="text-3xl font-bold text-foreground mt-1">{formatTime(attemptData.duration_seconds)}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm text-center flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Needs Review</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{incorrectCount}</p>
          <p className="text-sm text-muted-foreground mt-2">Incorrect Answers</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 justify-center py-6 border-y border-border">
        <button 
          onClick={() => generateReportPdf({ score: attemptData.correct_count, totalQuestions: attemptData.verified_questions_count, timeTaken: formatTime(attemptData.duration_seconds), answers: attemptData.answers }, questions)}
          className="flex items-center px-4 py-2 bg-card border border-border text-foreground font-medium rounded-md hover:bg-secondary transition shadow-sm"
        >
          <Download className="mr-2 h-4 w-4 text-muted-foreground" /> Export Performance Report
        </button>
        <button 
          onClick={() => generateQuizPdf(questions, true, true, quiz.title + " (Answer Key)")}
          className="flex items-center px-4 py-2 bg-card border border-border text-foreground font-medium rounded-md hover:bg-secondary transition shadow-sm"
        >
          <Download className="mr-2 h-4 w-4 text-muted-foreground" /> Download Answer Key
        </button>
        <Link 
          to={`/quiz/${quiz.id}?forceNew=true`}
          className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition shadow-sm"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Retry Assessment
        </Link>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-foreground">Review Incorrect Answers</h2>
        {incorrectCount === 0 ? (
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-8 text-center text-emerald-800 shadow-sm">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
            <h3 className="text-lg font-semibold">Perfect Score!</h3>
            <p className="text-emerald-700 mt-1">You answered all verified questions correctly.</p>
          </div>
        ) : (
          questions.map((q, index) => {
            const selectedOptId = attemptData.answers[q.id];
            if (selectedOptId === q.correctOptionId) return null;
            if (q.verificationStatus !== 'verified') return null; // Only review verified missed questions
            
            const selectedOpt = q.options.find(o => o.id === selectedOptId);
            const correctOpt = q.options.find(o => o.id === q.correctOptionId);
            const aiExplanation = attemptData.aiExplanations?.[q.id];
            
            return (
              <div key={q.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border bg-destructive/5 flex items-start">
                  <XCircle className="h-5 w-5 text-destructive mr-3 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground text-sm uppercase tracking-wider">Item {index + 1}</span>
                    <p className="text-foreground mt-2 font-medium leading-relaxed">{q.questionText}</p>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Selection</p>
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive/80 line-through opacity-80 text-sm">
                      {selectedOpt ? <><span className="font-bold mr-2">{selectedOpt.label}.</span>{selectedOpt.text}</> : 'Not answered'}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Verified Key</p>
                    <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-md text-emerald-900 font-medium text-sm shadow-sm">
                      {correctOpt ? <><span className="font-bold mr-2">{correctOpt.label}.</span>{correctOpt.text}</> : 'Unknown'}
                    </div>
                  </div>
                </div>
                {(q.explanation || aiExplanation) && (
                  <div className="p-6 bg-secondary/30 border-t border-border text-sm">
                    {q.explanation && (
                      <div className="mb-5">
                        <span className="font-semibold text-foreground block mb-2 uppercase tracking-wider text-xs">Source Context:</span>
                        <p className="text-muted-foreground leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                    {aiExplanation && (
                      <div>
                        <span className="font-semibold text-primary flex items-center mb-2 uppercase tracking-wider text-xs">
                          AI Tutor Analysis:
                        </span>
                        <p className="text-muted-foreground leading-relaxed">{aiExplanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      <div className="pt-4 pb-8 flex justify-center">
        <Link 
          to="/"
          className="flex items-center px-4 py-2 text-muted-foreground hover:text-foreground font-medium transition"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
