import express from 'express';
import * as tutorController from '../controllers/tutorController.js';

const router = express.Router();

router.post('/conversations', tutorController.createConversation);
router.get('/conversations/:id', tutorController.getConversation);
router.post('/conversations/:id/messages', tutorController.sendMessage);
router.post('/generate', tutorController.generateQuiz);

export default router;
