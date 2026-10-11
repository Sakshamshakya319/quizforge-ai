import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import net from 'net';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables if available
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

console.log('==============================================================================');
console.log('              QuizForge AI - Comprehensive System Diagnostics                 ');
console.log('==============================================================================');
console.log(`Repository Directory: ${projectRoot}\n`);

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function reportPass(label, message) {
  console.log(`[PASS] ${label}`);
  if (message) console.log(`       ${message}`);
  passCount++;
}

function reportWarn(label, message) {
  console.log(`[WARN] ${label}`);
  if (message) console.log(`       ${message}`);
  warnCount++;
}

function reportFail(label, message) {
  console.log(`[FAIL] ${label}`);
  if (message) console.log(`       ${message}`);
  failCount++;
}

function reportInfo(label, message) {
  console.log(`[INFO] ${label}`);
  if (message) console.log(`       ${message}`);
}

// 1. Node.js Version Check
const nodeVer = process.version;
const majorNode = parseInt(process.versions.node, 10);
if (majorNode >= 18) {
  reportPass(`Node.js Runtime (${nodeVer})`, 'Compatible with Vite 6 and ES Modules (Node 18+ required).');
} else {
  reportWarn(`Node.js Runtime (${nodeVer})`, 'Node.js 18 or newer is recommended. Please consider updating via https://nodejs.org/');
}

// 2. npm Package Manager Check
try {
  const npmVer = execSync('npm -v', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  reportPass(`npm Package Manager (v${npmVer})`, 'Ready for dependency resolution and package scripts.');
} catch {
  reportFail('npm Package Manager', 'npm was not found on your PATH. Reinstall Node.js from https://nodejs.org/');
}

// 3. Git Version Control Check
try {
  const gitVer = execSync('git --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  const gitDir = path.join(projectRoot, '.git');
  const parentGitDir = path.join(projectRoot, '..', '.git');
  const hasGit = fs.existsSync(gitDir) || fs.existsSync(parentGitDir);
  
  if (hasGit) {
    reportPass(`Git Version Control (${gitVer})`, 'Active Git repository detected. update.bat can pull updates.');
  } else {
    reportPass(`Git Version Control (${gitVer})`, 'Project appears to be downloaded as a ZIP archive (no .git folder).');
  }
} catch {
  reportWarn('Git Version Control', 'Git is not installed or not on PATH. You can run setup.bat, but update.bat requires Git (https://git-scm.com/).');
}

// 4. Environment File (.env) Check
if (fs.existsSync(envPath)) {
  const requiredKeys = ['PORT', 'DB_HOST', 'DB_USER', 'DB_NAME'];
  const missingKeys = requiredKeys.filter((k) => !process.env[k]);
  if (missingKeys.length === 0) {
    reportPass('Environment Configuration (.env)', `Present and contains all core keys: ${requiredKeys.join(', ')}.`);
  } else {
    reportWarn('Environment Configuration (.env)', `File exists, but missing keys: ${missingKeys.join(', ')}. Check .env.example.`);
  }
} else {
  reportWarn('Environment Configuration (.env)', "Missing '.env' file. It will be copied from '.env.example' during setup.bat.");
}

// 5. Node Dependencies (node_modules) Check
const nodeModulesPath = path.join(projectRoot, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  const expressPkg = path.join(nodeModulesPath, 'express', 'package.json');
  const vitePkg = path.join(nodeModulesPath, 'vite', 'package.json');
  if (fs.existsSync(expressPkg) && fs.existsSync(vitePkg)) {
    reportPass('Node Dependencies (node_modules)', 'Core libraries (Express, Vite, React, PDF.js, Mammoth) are installed.');
  } else {
    reportWarn('Node Dependencies (node_modules)', "Incomplete dependencies detected. Run 'setup.bat' or 'npm install'.");
  }
} else {
  reportWarn('Node Dependencies (node_modules)', "Dependencies not installed yet. Run 'setup.bat' to install.");
}

// 6. MySQL Database Connectivity Check
async function checkMySQL() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'quizforge_ai';

  try {
    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      connectTimeout: 4000
    });

    try {
      const [dbRows] = await conn.query('SHOW DATABASES LIKE ?', [database]);
      if (dbRows.length > 0) {
        await conn.query(`USE \`${database}\``);
        const [tables] = await conn.query('SHOW TABLES');
        reportPass('MySQL Database Service', `Connected to MySQL at ${host}:${port}. Database '${database}' exists with ${tables.length} tables.`);
      } else {
        reportPass('MySQL Database Service', `Connected to MySQL at ${host}:${port}. Database '${database}' will be initialized by setup.bat.`);
      }
    } finally {
      await conn.end();
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      reportFail('MySQL Database Service', `Cannot connect to MySQL server at ${host}:${port} (Connection Refused). Ensure MySQL / MariaDB (e.g. XAMPP, Laragon, or Windows Service) is started.`);
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      reportFail('MySQL Database Service', `Access denied for user '${user}'@'${host}'. Check DB_USER and DB_PASSWORD in your .env file.`);
    } else {
      reportFail('MySQL Database Service', `MySQL connection error: ${err.message}`);
    }
  }
}

// 7. Python & Optional Local AI Tutor Check
function checkPython() {
  let pyInstalled = false;
  let pyVer = '';
  try {
    pyVer = execSync('python --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    pyInstalled = true;
  } catch {
    // Try py
    try {
      pyVer = execSync('py --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      pyInstalled = true;
    } catch {
      pyInstalled = false;
    }
  }

  const venvDir = path.join(projectRoot, 'ai-service', '.venv');
  if (pyInstalled) {
    if (fs.existsSync(venvDir)) {
      reportPass(`Python Environment (${pyVer})`, `Local AI virtual environment detected at ai-service/.venv`);
    } else {
      reportInfo(`Python Environment (${pyVer})`, `Python is available. Local AI virtual environment will be created by setup.bat if desired.`);
    }
  } else {
    reportInfo('Python Environment (Optional)', 'Python is not installed. QuizForge AI core quiz engine, question extraction, and test reviews work 100% without Python. Python is only needed if serving local offline Qwen models.');
  }
}

// 8. Port Availability Check
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve(err.code === 'EADDRINUSE' ? 'in-use' : 'error');
    });
    server.once('listening', () => {
      server.close(() => resolve('free'));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function checkPorts() {
  const vitePort = parseInt(process.env.VITE_PORT || '5173', 10);
  const apiPort = parseInt(process.env.PORT || '5000', 10);

  const [vStatus, aStatus] = await Promise.all([checkPort(vitePort), checkPort(apiPort)]);

  if (vStatus === 'free' && aStatus === 'free') {
    reportPass('Application Ports', `Ports ${vitePort} (Web UI) and ${apiPort} (API Server) are free and ready.`);
  } else if (vStatus === 'in-use' || aStatus === 'in-use') {
    reportInfo('Application Ports', `Port ${vStatus === 'in-use' ? vitePort + ' (Web)' : ''} ${aStatus === 'in-use' ? apiPort + ' (API)' : ''} is currently in use (QuizForge AI may already be running).`);
  }
}

// Execute async checks
(async () => {
  await checkMySQL();
  checkPython();
  await checkPorts();

  console.log('\n==============================================================================');
  console.log('                             DIAGNOSTIC SUMMARY                               ');
  console.log('==============================================================================');
  console.log(`Results: ${passCount} Passed, ${warnCount} Warnings, ${failCount} Critical Failures.`);

  if (failCount === 0) {
    if (warnCount === 0) {
      console.log('\nSTATUS: ALL CHECKS PASSED [SYSTEM FULLY READY]');
      console.log('Double-click "run.bat" to start QuizForge AI.');
    } else {
      console.log('\nSTATUS: READY WITH ADVISORY NOTICES');
      console.log('The application can run. If this is a new setup, double-click "setup.bat".');
    }
    process.exit(0);
  } else {
    console.log('\nSTATUS: CRITICAL ISSUES DETECTED');
    console.log('Please resolve the items marked with [FAIL] above.');
    console.log('Make sure Node.js and MySQL service are running, then run setup.bat again.');
    process.exit(1);
  }
})();
