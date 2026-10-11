import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabase() {
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT || 3306);
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'quizforge_ai';

    try {
        const conn = await mysql.createConnection({ host, port, user, password });
        console.log(`[PASS] MySQL server is reachable at ${host}:${port} (user: ${user})`);
        
        try {
            await conn.query(`USE \`${database}\``);
            console.log(`[PASS] Database '${database}' exists and is accessible.`);
            
            const [tables] = await conn.query('SHOW TABLES');
            console.log(`[PASS] Found ${tables.length} tables in database '${database}'.`);
        } catch (dbErr) {
            console.log(`[WARNING] Database '${database}' does not exist yet. Run setup.bat to create it.`);
        }
        
        await conn.end();
        process.exit(0);
    } catch (err) {
        console.error(`[FAIL] Could not connect to MySQL at ${host}:${port}: ${err.message}`);
        console.error(`       Please verify MySQL is running and check DB_USER / DB_PASSWORD in .env.`);
        process.exit(1);
    }
}

checkDatabase();
