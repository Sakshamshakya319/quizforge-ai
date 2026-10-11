import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

app.get('/api/health/db', async (req, res) => {
    const { pool } = await import('./config/database.js');
    try {
        const [rows] = await pool.execute('SELECT 1 AS connected');
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(503).json({ status: 'error', database: 'unavailable' });
    }
});

app.get('/api/health/ai', async (req, res) => {
    const aiUrl = process.env.QWEN_TUTOR_API_URL || 'http://localhost:8001/api/v1/tutor/chat';
    // We check the FastAPI server health endpoint directly since the chat endpoint requires a body
    const healthUrl = aiUrl.replace('/api/v1/tutor/chat', '/health');
    try {
        const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) {
            return res.status(503).json({ status: 'error', ai_service: 'unavailable', details: response.statusText });
        }
        const data = await response.json();
        res.json({ status: 'ok', ai_service: 'connected', details: data });
    } catch (err) {
        res.status(503).json({ status: 'error', ai_service: 'unavailable', details: err.message });
    }
});

import documentRoutes from './routes/documents.js';
import quizRoutes from './routes/quizzes.js';
import attemptRoutes from './routes/attempts.js';
import tutorRoutes from './routes/tutor.js';

app.use('/api/documents', documentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/tutor', tutorRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'An unexpected error occurred'
    });
});

export default app;
