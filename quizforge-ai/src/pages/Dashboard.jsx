import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuiz } from '../contexts/QuizContext';
import { FileText, Trophy, Clock, Sparkles, UploadCloud, Library, CheckCircle2, TrendingUp, Play, AlertCircle, Trash2 } from 'lucide-react';
import DeleteQuizModal from '../components/DeleteQuizModal';

export default function Dashboard() {
  const { quizzes } = useQuiz();
  const [quizToDelete, setQuizToDelete] = useState(null);
  
  const totalQuizzes = quizzes.length;
  let totalAttempts = 0;
  let totalScore = 0;
  let totalPossibleScore = 0;
  let totalQuestions = 0;
  
  quizzes.forEach(q => {
    totalQuestions += (q.questions?.length || 0);
    if (q.attempts) {
      q.attempts.forEach(a => {
        totalAttempts++;
        totalScore += a.score;
        totalPossibleScore += a.totalQuestions;
      });
    }
  });
  
  const avgScore = totalPossibleScore > 0 ? Math.round((totalScore / totalPossibleScore) * 100) : 0;

  return (
    <>
      <DeleteQuizModal
        quiz={quizToDelete}
        onClose={() => setQuizToDelete(null)}
      />

      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Banner */}
        <div className="bg-white border border-border rounded-xl p-8 flex flex-col md:flex-row items-center justify-between shadow-sm relative overflow-hidden">
          <div className="relative z-10 md:max-w-2xl">
            <h2 className="text-2xl font-bold text-foreground mb-2">Transform Course Notes into Mastery Quizzes in Seconds</h2>
            <p className="text-muted-foreground mb-6">Upload lecture slides, research papers, or syllabus chapters to automatically generate validated multiple-choice assessments.</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/upload" className="inline-flex justify-center items-center px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition shadow-sm">
                <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
              </Link>
            </div>
          </div>
          <div className="hidden md:block absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none"></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg"><Library className="h-5 w-5" /></div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Total Quizzes</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalQuizzes}</p>
          </div>
          
          <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg"><CheckCircle2 className="h-5 w-5" /></div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Completed Attempts</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalAttempts}</p>
          </div>
          
          <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg"><TrendingUp className="h-5 w-5" /></div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Avg. Verified Score</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalPossibleScore > 0 ? `${avgScore}%` : 'N/A'}</p>
          </div>
          
          <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg"><FileText className="h-5 w-5" /></div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Questions Extracted</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalQuestions}</p>
          </div>
        </div>

        {/* Recent Quizzes Table */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-white">
            <h3 className="font-semibold text-lg text-foreground">Recent Quizzes</h3>
          </div>
          
          {totalQuizzes === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Library className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No quizzes found. Upload a document to generate your first quiz.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Quiz Title & Source</th>
                    <th className="px-6 py-3 font-semibold">Questions</th>
                    <th className="px-6 py-3 font-semibold">Latest Score</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.slice().reverse().map(quiz => {
                    let lastAttemptScore = null;
                    if (quiz.attempts && quiz.attempts.length > 0) {
                      const lastAttempt = quiz.attempts[quiz.attempts.length - 1];
                      lastAttemptScore = Math.round((lastAttempt.score / lastAttempt.totalQuestions) * 100);
                    }
                    
                    const hasQuestions = quiz.questions && quiz.questions.length > 0;
                    
                    return (
                      <tr key={quiz.id} className="bg-card border-b border-border hover:bg-secondary/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{quiz.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center">
                            <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px] uppercase mr-2 border border-border">{quiz.sourceFile?.split('.').pop() || 'Unknown'}</span>
                            {quiz.sourceFile || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {quiz.questions?.length || 0} MCQs
                        </td>
                        <td className="px-6 py-4">
                          {lastAttemptScore !== null ? (
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lastAttemptScore >= 80 ? 'bg-emerald-100 text-emerald-800' : lastAttemptScore >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-destructive/10 text-destructive'}`}>
                                {lastAttemptScore}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not attempted</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center space-x-3">
                            {/* Delete action */}
                            <button
                              onClick={() => setQuizToDelete({ id: quiz.id, title: quiz.title })}
                              aria-label={`Delete quiz: ${quiz.title}`}
                              title="Delete quiz"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>

                            {hasQuestions ? (
                              <Link to={`/quiz/${quiz.id}`} className="flex items-center text-primary font-medium hover:text-primary/80 transition-colors">
                                <Play className="h-4 w-4 mr-1" /> Play
                              </Link>
                            ) : (
                              <span className="flex items-center text-muted-foreground text-xs" title="This quiz has no extracted questions.">
                                <AlertCircle className="h-3 w-3 mr-1" /> Empty
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
