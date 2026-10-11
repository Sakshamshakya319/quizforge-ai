import React, { useEffect, useRef, useState } from 'react';
import { Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';
import { useQuiz } from '../contexts/QuizContext';

/**
 * DeleteQuizModal
 *
 * Props:
 *  - quiz       : { id, title } — the quiz to delete (null = modal closed)
 *  - onClose    : () => void  — called when the user cancels or after successful deletion
 */
export default function DeleteQuizModal({ quiz, onClose }) {
  const { deleteQuiz } = useQuiz();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const cancelRef = useRef(null);

  // Focus the Cancel button when modal opens
  useEffect(() => {
    if (quiz) {
      setDeleteError('');
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [quiz]);

  // Close on Escape key
  useEffect(() => {
    if (!quiz) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isDeleting) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [quiz, isDeleting, onClose]);

  if (!quiz) return null;

  const handleConfirm = async () => {
    if (isDeleting) return; // prevent double-click
    setDeleteError('');
    setIsDeleting(true);
    try {
      await deleteQuiz(quiz.id);
      onClose(); // only close after confirmed server success
    } catch (err) {
      setDeleteError(
        err.message === 'Quiz not found.'
          ? 'This quiz has already been deleted.'
          : err.message || 'The quiz could not be deleted. Please try again.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBackdropClick = (e) => {
    // Clicking outside the dialog panel while not deleting closes the modal
    if (e.target === e.currentTarget && !isDeleting) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div className="relative bg-white border border-border rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <h2 id="delete-modal-title" className="text-lg font-bold text-foreground">
              Delete this quiz permanently?
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close dialog"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-2">
          <p id="delete-modal-desc" className="text-sm text-muted-foreground leading-relaxed">
            You are about to permanently delete:
          </p>
          <p className="mt-2 px-3 py-2 bg-secondary/50 border border-border rounded-md text-sm font-semibold text-foreground truncate">
            {quiz.title}
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            This will permanently remove the quiz, all its questions, answer options, quiz
            attempt history, and AI tutor conversations. <span className="font-semibold text-foreground">This cannot be undone.</span>
          </p>

          {/* Error banner */}
          {deleteError && (
            <div className="mt-3 flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{deleteError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 p-6 pt-5">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            aria-label={`Confirm permanent deletion of ${quiz.title}`}
            className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Delete Permanently
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
