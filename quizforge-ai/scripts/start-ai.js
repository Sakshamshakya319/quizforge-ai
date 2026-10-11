import { spawn } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const STATIQ_DIR = process.env.STATIQ_PROJECT_DIR || 'D:\\Projects\\StatIQ-AI-project';

const LlamaPort = 8082;
const FastApiPort = 8001;

const children = [];

async function checkPort(url) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch (err) {
        return false;
    }
}

async function waitForServer(url, name) {
    console.log(`Waiting for ${name} to become ready...`);
    for (let i = 0; i < 30; i++) {
        if (await checkPort(url)) {
            console.log(`[OK] ${name} is ready at ${url}`);
            return true;
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`Timeout waiting for ${name} at ${url}`);
}

async function startLlamaServer() {
    const healthUrl = `http://127.0.0.1:${LlamaPort}/health`;
    const isRunning = await checkPort(healthUrl);
    
    if (isRunning) {
        console.log(`[INFO] llama-server is already running on port ${LlamaPort}. Reusing it.`);
        return;
    }
    
    console.log(`[STARTING] llama-server...`);
    const engineDir = path.join(STATIQ_DIR, 'nextgen-engine');
    const llamaExe = path.join(engineDir, 'llama-server.exe');
    const proc = spawn(llamaExe, [
        '-m', 'models\\qwen2.5-0.5b-instruct-q4_k_m.gguf',
        '-c', '8192',
        '--port', LlamaPort.toString()
    ], {
        cwd: engineDir,
        stdio: 'inherit'
    });
    
    children.push({ name: 'llama-server', proc });
    
    await waitForServer(healthUrl, 'llama-server');
}

async function startFastApi() {
    const healthUrl = `http://127.0.0.1:${FastApiPort}/health`;
    const isRunning = await checkPort(healthUrl);
    
    if (isRunning) {
        console.log(`[INFO] FastAPI tutor service is already running on port ${FastApiPort}. Reusing it.`);
        return;
    }
    
    console.log(`[STARTING] FastAPI tutor service (QuizForge)...`);
    const serviceDir = path.join(process.cwd(), 'ai-service');
    
    if (!fs.existsSync(serviceDir)) {
        throw new Error(`Cannot find QuizForge AI service directory: ${serviceDir}`);
    }
    
    // Resolve python executable: check StatIQ venv, then local ai-service venv, then system python
    let pythonExe = 'python';
    if (STATIQ_DIR && fs.existsSync(STATIQ_DIR)) {
        const statiqVenv = path.join(STATIQ_DIR, 'nextgen-engine', '.venv', 'Scripts', 'python.exe');
        if (fs.existsSync(statiqVenv)) {
            pythonExe = statiqVenv;
        }
    } else {
        const localVenv = path.join(serviceDir, '.venv', 'Scripts', 'python.exe');
        if (fs.existsSync(localVenv)) {
            pythonExe = localVenv;
        }
    }
    
    const proc = spawn(pythonExe, [
        '-m', 'uvicorn',
        'app.main:app',
        '--port', FastApiPort.toString()
    ], {
        cwd: serviceDir,
        stdio: 'inherit'
    });
    
    children.push({ name: 'FastAPI', proc });
    
    await waitForServer(healthUrl, 'FastAPI Tutor Service');
}

async function main() {
    try {
        const hasStatiq = STATIQ_DIR && fs.existsSync(STATIQ_DIR);
        
        if (hasStatiq) {
            await startLlamaServer();
            await startFastApi();
            console.log('\n[SUCCESS] AI Service Stack is fully initialized and ready.\n');
        } else {
            console.log('\n[NOTICE] Local StatIQ model directory not found at: ' + (STATIQ_DIR || '(not set)'));
            console.log('         To enable local AI Tutor analysis, set STATIQ_PROJECT_DIR in .env');
            console.log('         The Web App (http://localhost:5173) and Backend (http://localhost:5000) are fully operational!\n');
            
            // Try to start FastAPI if local venv is available
            const localVenv = path.join(process.cwd(), 'ai-service', '.venv', 'Scripts', 'python.exe');
            if (fs.existsSync(localVenv)) {
                try {
                    await startFastApi();
                } catch (e) {
                    console.log('         FastAPI service idle (awaiting model backend).');
                }
            }
        }
        
        // Keep the process alive so concurrently doesn't exit and trigger --kill-others
        console.log('[INFO] AI Orchestrator running. Press Ctrl+C to stop all services.');
        setInterval(() => {}, 1000 * 60 * 60);
    } catch (err) {
        console.error(`\n[ERROR] Failed to start AI services: ${err.message}\n`);
        cleanup();
        process.exit(1);
    }
}

function cleanup() {
    for (const child of children) {
        console.log(`Stopping ${child.name}...`);
        if (child.proc && !child.proc.killed) {
            // Using tree-kill approach on windows or just simple kill
            child.proc.kill('SIGTERM');
        }
    }
}

process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
});
process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
});

main();
