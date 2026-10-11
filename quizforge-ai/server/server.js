import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { checkConnection, pool } from './config/database.js';
import { initAttemptSchemaAndReconcile } from './services/reconciliationService.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    if (!process.env.DB_USER || !process.env.DB_NAME) {
        console.error('Missing required database environment variables (DB_USER, DB_NAME).');
        process.exit(1);
    }

    await checkConnection();
    await initAttemptSchemaAndReconcile();

    const server = app.listen(PORT, () => {
        console.log(`QuizForge AI Backend running on port ${PORT}`);
    });

    const shutdown = async () => {
        console.log('\nShutting down server...');
        server.close(async () => {
            console.log('HTTP server closed.');
            try {
                await pool.end();
                console.log('Database connection pool closed.');
                process.exit(0);
            } catch (err) {
                console.error('Error closing database connection pool:', err);
                process.exit(1);
            }
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
};

startServer();
