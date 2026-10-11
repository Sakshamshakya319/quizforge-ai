import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const requiredVariables = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
];

for (const variable of requiredVariables) {
    if (process.env[variable] === undefined) {
        throw new Error(`Missing required environment variable: ${variable}`);
    }
}

export const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0
});

export const checkConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully connected to the database.');
        connection.release();
    } catch (err) {
        console.error('Database connection failed. Ensure MySQL is running and credentials are correct.');
        console.error(err.message);
        process.exit(1);
    }
};
