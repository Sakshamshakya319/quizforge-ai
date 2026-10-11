import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../services/api';

const QuizContext = createContext();

export const useQuiz = () => useContext(QuizContext);

export const QuizProvider = ({ children }) => {
  const [quizzes, setQuizzes] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quizzesError, setQuizzesError] = useState(null);
  
  const refreshQuizzes = useCallback(async () => {
    try {
      setIsLoading(true);
      setQuizzesError(null);
      const data = await fetchApi('/quizzes');
      setQuizzes(data);
    } catch (err) {
      console.error('Failed to fetch quizzes', err);
      setQuizzesError(err.message || 'Failed to load quizzes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshQuizzes();
  }, [refreshQuizzes]);

  // addQuiz pushes to backend Document, Quiz, and Questions bulk
  const addQuiz = async (quizData) => {
    // ── Pre-flight validation ──────────────────────────────────────────
    if (!quizData.title || !quizData.title.trim()) {
      throw new Error('Quiz title is required before publishing.');
    }
    if (!Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      throw new Error('No questions found. Please extract or generate questions before publishing.');
    }
    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i];
      if (!q.questionText || !q.questionText.trim()) {
        throw new Error(`Question ${i + 1} has no text. Edit it before publishing.`);
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`Question ${i + 1} has fewer than 2 options. Edit it before publishing.`);
      }
      for (const opt of q.options) {
        if (!opt.text || !opt.text.trim()) {
          throw new Error(`Question ${i + 1}, option ${opt.label || '?'} has no text. Edit it before publishing.`);
        }
      }
      if (!q.correctOptionId) {
        throw new Error(`Question ${i + 1} has no correct answer selected. Mark an answer before publishing.`);
      }
      const correctExists = q.options.some(o => o.id === q.correctOptionId);
      if (!correctExists) {
        throw new Error(`Question ${i + 1}: the marked correct answer does not match any option. Edit the answer key before publishing.`);
      }
    }

    try {
      // ── 1. Derive safe document metadata ────────────────────────────
      // sourceFile may be undefined when the quiz was constructed without it
      // (e.g. programmatic tests or legacy in-memory quizzes).
      const sourceFile = quizData.sourceFile || '';
      const lastDot    = sourceFile.lastIndexOf('.');
      const fileType   = lastDot > 0 ? sourceFile.slice(lastDot + 1).toLowerCase() : 'unknown';
      const filename   = sourceFile || 'Unknown Document';

      const docRes = await fetchApi('/documents', {
        method: 'POST',
        body: JSON.stringify({
          original_filename: filename,
          file_type: fileType,
          file_size: 1024, // file is processed in-browser; we store a nominal size
          total_questions: quizData.questions.length
        })
      });

      // ── 2. Create Quiz ───────────────────────────────────────────────
      const quizRes = await fetchApi('/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: quizData.title.trim(),
          document_id: docRes.id
        })
      });

      // ── 3. Save Questions Bulk (transactional on the server) ─────────
      await fetchApi(`/quizzes/${quizRes.id}/questions/bulk`, {
        method: 'POST',
        body: JSON.stringify({ questions: quizData.questions })
      });

      // ── 4. Reload quizzes list and update context ────────────────────
      await refreshQuizzes();

      // Preserve sourceFile so downstream pages (e.g. VerifyQuiz display) still work
      const newQuiz = { ...quizRes, sourceFile: filename, questions: quizData.questions };
      setCurrentQuiz(newQuiz);

      return newQuiz;
    } catch (err) {
      console.error('Error saving quiz:', err);
      throw err;
    }
  };

  // deleteQuiz: optimistic removal with server-side confirmation and rollback on error
  const deleteQuiz = async (quizId) => {
    // Snapshot current state for rollback
    const previousQuizzes = quizzes;

    // Optimistically remove from UI immediately
    setQuizzes(prev => prev.filter(q => q.id !== quizId));

    try {
      await fetchApi(`/quizzes/${quizId}`, { method: 'DELETE' });
      // Success — state is already updated. Also clear currentQuiz if it was the deleted one.
      setCurrentQuiz(prev => (prev && prev.id === quizId ? null : prev));
    } catch (err) {
      // Rollback the optimistic update
      setQuizzes(previousQuizzes);
      throw err; // re-throw so the modal can display the error
    }
  };
  
  const saveAttempt = async (quizId, attemptData) => {
    try {
      // Create Attempt
      const startRes = await fetchApi(`/attempts/quiz/${quizId}`, {
        method: 'POST'
      });
      
      // Save all answers sequentially
      for (const [qId, optId] of Object.entries(attemptData.answers)) {
        await fetchApi(`/attempts/${startRes.id}/answers/${qId}`, {
          method: 'PUT',
          body: JSON.stringify({ selected_option_id: optId })
        });
      }
      
      // Submit
      const submitRes = await fetchApi(`/attempts/${startRes.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ duration_seconds: attemptData.timeTaken })
      });
      
      // Also save AI tutor messages if there are any
      if (attemptData.aiExplanations && Object.keys(attemptData.aiExplanations).length > 0) {
        // Find existing chat logs to persist, ideally this would be done during the chat itself.
        // We'll trust the tutor integration to have handled it live, or we skip full bulk upload here.
      }
      
      return startRes.id; // Return attempt ID
    } catch (err) {
      console.error('Error saving attempt:', err);
      throw err;
    }
  };

  return (
    <QuizContext.Provider value={{
      quizzes,
      currentQuiz,
      setCurrentQuiz,
      addQuiz,
      deleteQuiz,
      saveAttempt,
      refreshQuizzes,
      isLoading,
      isLoadingQuizzes: isLoading, // alias for pages that use this name
      error: quizzesError,
    }}>
      {children}
    </QuizContext.Provider>
  );
};
