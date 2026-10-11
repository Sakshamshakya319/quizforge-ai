import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuiz } from '../contexts/QuizContext';
import { Library, Play, FileText, AlertCircle, Trash2 } from 'lucide-react';
import DeleteQuizModal from '../components/DeleteQuizModal';

export default function MyQuizzes() {
  const { quizzes, isLoadingQuizzes, error } = useQuiz();
  const [quizToDelete, setQuizToDelete] = useState(null); // { id, title } or null

  if (isLoadingQuizzes) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground">Loading your quizzes...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-80" />
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
        <Library className="h-12 w-12 mx-auto mb-4 opacity-20 text-muted-foreground" />
        <h3 className="text-lg font-medium text-foreground mb-2">No quizzes yet</h3>
        <p className="text-muted-foreground mb-6">Upload a PDF, PowerPoint, or Word document containing MCQs to create your first quiz.</p>
        <Link to="/upload" className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm">
          Create Quiz
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Delete confirmation modal — rendered at root level to avoid z-index issues */}
      <DeleteQuizModal
        quiz={quizToDelete}
        onClose={() => setQuizToDelete(null)}
      />

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">My Quizzes</h2>
          <Link to="/upload" className="inline-flex justify-center items-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition shadow-sm">
            Create New Quiz
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.slice().reverse().map(quiz => {
            const hasQuestions = quiz.questions && quiz.questions.length > 0;
            const extension = quiz.sourceFile?.split('.').pop() || 'Unknown';
            
            let lastAttemptScore = null;
            if (quiz.attempts && quiz.attempts.length > 0) {
              const lastAttempt = quiz.attempts[quiz.attempts.length - 1];
              lastAttemptScore = Math.round((lastAttempt.score / lastAttempt.totalQuestions) * 100);
            }

            return (
              <div key={quiz.id} className="bg-card border border-border rounded-xl shadow-sm flex flex-col hover:border-primary/40 transition-colors group">
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-secondary text-muted-foreground px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider border border-border">
                      {extension}
                    </span>
                    {lastAttemptScore !== null && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lastAttemptScore >= 80 ? 'bg-emerald-100 text-emerald-800' : lastAttemptScore >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-destructive/10 text-destructive'}`}>
                        {lastAttemptScore}%
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{quiz.title}</h3>
                  <div className="text-xs text-muted-foreground mb-4 truncate" title={quiz.sourceFile}>
                    {quiz.sourceFile || 'Unknown source'}
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground font-medium">
                    <FileText className="h-4 w-4 mr-1.5 opacity-70" />
                    {quiz.questions?.length || 0} Questions
                  </div>
                </div>
                
                <div className="px-5 py-4 border-t border-border bg-secondary/30 flex justify-between items-center rounded-b-xl">
                  <span className="text-xs text-muted-foreground font-medium">
                    {new Date(quiz.createdAt || quiz.created_at).toLocaleDateString()}
                  </span>
                  
                  <div className="flex items-center space-x-3">
                    {/* Delete button */}
                    <button
                      onClick={() => setQuizToDelete({ id: quiz.id, title: quiz.title })}
                      aria-label={`Delete quiz: ${quiz.title}`}
                      title="Delete quiz"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {hasQuestions ? (
                      <Link to={`/quiz/${quiz.id}`} className="flex items-center text-primary font-bold hover:text-primary/80 transition-colors text-sm">
                        <Play className="h-4 w-4 mr-1" /> Start
                      </Link>
                    ) : (
                      <span className="flex items-center text-muted-foreground text-xs" title="This quiz has no extracted questions.">
                        <AlertCircle className="h-3 w-3 mr-1" /> Empty
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
