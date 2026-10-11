import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT || 3306);
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const databaseName = process.env.DB_NAME || 'quizforge_ai';

    console.log(`[Database Init] Connecting to MySQL server at ${host}:${port} as '${user}'...`);

    let serverConn;
    try {
        serverConn = await mysql.createConnection({
            host,
            port,
            user,
            password,
        });
    } catch (err) {
        console.error(`\n❌ [Database Error] Could not connect to MySQL at ${host}:${port}.`);
        console.error(`   Details: ${err.message}`);
        console.error('\n   Troubleshooting suggestions:');
        console.error('   1. Ensure MySQL / MariaDB service is running (e.g., start MySQL in XAMPP Control Panel).');
        console.error('   2. Verify DB_USER and DB_PASSWORD in your .env file.');
        console.error('   3. If using a custom port, verify DB_PORT in .env.\n');
        process.exit(1);
    }

    try {
        console.log(`[Database Init] Creating database '${databaseName}' if it does not exist...`);
        await serverConn.execute(
            `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        console.log(`[Database Init] Database '${databaseName}' is ready.`);
    } finally {
        await serverConn.end();
    }

    // Connect to the specific database and apply schema
    const pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database: databaseName,
        multipleStatements: true,
    });

    try {
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            console.log(`[Database Init] Applying schema from ${schemaPath}...`);
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            // Execute the schema script
            await pool.query(schemaSql);
            console.log('[Database Init] Tables verified and created successfully.');
        }

        // Run reconciliation and active-attempt uniqueness check
        const { initAttemptSchemaAndReconcile } = await import('../server/services/reconciliationService.js');
        await initAttemptSchemaAndReconcile();

        console.log(`\n✅ [Success] Database '${databaseName}' setup and migrations completed successfully!\n`);
        process.exit(0);
    } catch (err) {
        console.error(`\n❌ [Database Error] Failed during schema application: ${err.message}`);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

initDatabase();
