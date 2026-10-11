import express from 'express';
import * as quizzesController from '../controllers/quizzesController.js';

const router = express.Router();

router.post('/', quizzesController.createQuiz);
router.get('/', quizzesController.getQuizzes);
router.get('/:id', quizzesController.getQuiz);
router.patch('/:id', quizzesController.updateQuiz);
router.delete('/:id', quizzesController.deleteQuiz);

router.post('/:quizId/questions/bulk', quizzesController.saveQuestionsBulk);
router.get('/:quizId/questions', quizzesController.getQuizQuestions);

export default router;
