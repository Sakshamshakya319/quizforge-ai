import express from 'express';
import * as attemptsController from '../controllers/attemptsController.js';

const router = express.Router();

// ── Aggregate / non-ID routes first (must come before /:id to avoid collisions)
router.get('/history',                       attemptsController.getHistory);
router.get('/errors',                        attemptsController.getErrors);

// ── Start a brand-new attempt for a quiz
router.post('/quiz/:quizId',                 attemptsController.startAttempt);

// ── Check whether a resumable attempt exists for a quiz (used by QuizPlayer on load)
router.get('/quiz/:quizId/in-progress',      attemptsController.getInProgressAttempt);

// ── Single-attempt operations
router.get('/:id',                           attemptsController.getAttempt);
router.put('/:id/answers/:questionId',       attemptsController.saveAnswer);
router.patch('/:id/pause',                   attemptsController.pauseAttempt);
router.post('/:id/pause',                    attemptsController.pauseAttempt);
router.patch('/:id/resume',                  attemptsController.resumeAttempt);
router.post('/:id/submit',                   attemptsController.submitAttempt);
router.get('/:id/results',                   attemptsController.getAttemptResults);

export default router;
