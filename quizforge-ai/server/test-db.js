import dotenv from 'dotenv';
dotenv.config();
import { pool } from './config/database.js';

async function testConnection() {
    try {
        const [rows] = await pool.execute('SELECT 1 AS connected');
        console.log('Success: Database connection test passed!', rows);
    } catch (err) {
        console.error('Error connecting to the database:', err);
    } finally {
        await pool.end();
    }
}

testConnection();
