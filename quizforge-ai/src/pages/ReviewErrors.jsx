import React, { useState, useEffect } from 'react';
import { fetchApi } from '../services/api';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import TutorChat from '../components/TutorChat';

export default function ReviewErrors() {
  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    const loadErrors = async () => {
      try {
        setIsLoading(true);
        const data = await fetchApi('/attempts/errors');
        setErrors(data);
      } catch (err) {
        setFetchError('Failed to load errors.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadErrors();
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground">Loading review errors...</div>;
  }

  if (fetchError) {
    return <div className="p-8 text-center text-destructive">{fetchError}</div>;
  }

  if (errors.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-500 opacity-80" />
        <h3 className="text-lg font-medium text-foreground mb-2">No Errors Found!</h3>
        <p className="text-muted-foreground">You don't have any incorrect answers to review. Keep up the great work!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center mb-6">
        <AlertTriangle className="h-6 w-6 text-amber-500 mr-2" />
        <h2 className="text-2xl font-bold text-foreground">Review Errors</h2>
      </div>
      
      <div className="grid gap-6">
        {errors.map((error, index) => (
          <div key={`${error.attempt_id}-${error.question_id}`} className="bg-card border border-border rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                From Quiz: {error.quiz_title}
              </span>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                Attempt: {new Date(error.answered_at).toLocaleDateString()}
              </span>
            </div>
            
            <h3 className="text-lg font-medium text-foreground mb-4">{error.question_text}</h3>
            
            <div className="space-y-3 mb-4">
              <div className="flex items-start p-3 rounded-md bg-destructive/5 border border-destructive/10">
                <XCircle className="h-5 w-5 text-destructive mt-0.5 mr-3 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-destructive mb-1">Your Answer:</p>
                  <p className="text-sm text-foreground">{error.selected_option_text}</p>
                </div>
              </div>
              
              <div className="flex items-start p-3 rounded-md bg-emerald-50 border border-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 mr-3 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700 mb-1">Correct Answer:</p>
                  <p className="text-sm text-foreground">{error.correct_option_text}</p>
                </div>
              </div>
            </div>
            
            {error.original_explanation && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm font-medium text-foreground mb-1">Original Explanation:</p>
                <p className="text-sm text-muted-foreground">{error.original_explanation}</p>
              </div>
            )}
            
            <TutorChat errorContext={error} />
          </div>
        ))}
      </div>
    </div>
  );
}
