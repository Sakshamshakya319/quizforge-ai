import express from 'express';
import * as documentsController from '../controllers/documentsController.js';

const router = express.Router();

router.post('/', documentsController.createDocument);
router.get('/', documentsController.getDocuments);
router.get('/:id', documentsController.getDocument);
router.patch('/:id', documentsController.updateDocument);
router.delete('/:id', documentsController.deleteDocument);

export default router;
