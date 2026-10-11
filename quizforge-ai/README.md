# QuizForge AI — Smart Document-to-Quiz Platform

QuizForge AI is an intelligent educational platform that converts documents (`.pdf`, `.docx`, `.pptx`) and study notes into interactive multiple-choice quizzes. It features automated question extraction, an interactive quiz player with pause and resume support, detailed test analytics with downloadable PDF reports, and an integrated local AI tutor to explain mistakes.

---

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Start for Windows (Recommended)](#quick-start-for-windows-recommended)
- [Manual Setup (macOS / Linux / Advanced)](#manual-setup-macos--linux--advanced)
- [Configuration (.env)](#configuration-env)
- [Running the Application](#running-the-application)
- [Diagnostics & Verification](#diagnostics--verification)
- [Updating the Application](#updating-the-application)
- [Database Management](#database-management)
- [Troubleshooting](#troubleshooting)
- [Security Guidelines](#security-guidelines)
- [Contributing](#contributing)

---

## Features

- **Multi-Format Document Parsing:** Ingests `.pdf`, `.docx`, and `.pptx` documents with automatic detection of numbered questions, options (A–D), and answer keys.
- **Interactive Quiz Player:** Full test engine with real-time timers, question review flagging, score calculation, and progress persistence.
- **Single Active Attempt & Resume:** Guarantees one active attempt per quiz to prevent duplicate cards, with full Pause & Resume support.
- **AI Tutor Integration:** Context-aware AI explanations powered by local Qwen LLM models via an Express-mediated chat proxy.
- **PDF Report Generation:** One-click export of comprehensive quiz attempt reports and score cards using `jspdf` and `html2canvas`.
- **Relational Integrity:** MySQL relational schema with foreign key cascades, transaction boundaries, and automated migrations.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, Lucide Icons, React Router 7 |
| **Backend** | Express 5, Node.js (v18+), `mysql2/promise`, dotenv, cors |
| **Document Processing** | `pdfjs-dist` (local worker), `mammoth` (DOCX), `jszip` (PPTX) |
| **Database** | MySQL 8.0+ / MariaDB 10.4+ |
| **AI Service (Optional)**| FastAPI, Uvicorn, Local Qwen / llama.cpp / StatIQ engine |

---

## Prerequisites

Before setting up QuizForge AI, ensure the following software is installed on your computer:

1. **Node.js (LTS v18 or newer recommended):**
   - Download: [https://nodejs.org/](https://nodejs.org/)
   - Verify: `node -v` and `npm -v`

2. **MySQL / MariaDB Service:**
   - Any standard distribution works:
     - [XAMPP](https://www.apachefriends.org/) (Start the MySQL module)
     - [Laragon](https://laragon.org/) (Click 'Start All')
     - [MySQL Community Server](https://dev.mysql.com/downloads/mysql/)
   - Verify: Make sure MySQL is running on port `3306`.

3. **Git (Optional, recommended):**
   - Download: [https://git-scm.com/](https://git-scm.com/)
   - Required if you want `update.bat` to automatically pull updates.

4. **Python (Optional):**
   - Download: [https://www.python.org/](https://www.python.org/)
   - *Note:* Python is **optional**. The core document extraction, quiz generation, interactive quiz player, scoring, attempts, and history run 100% on Node.js and MySQL without Python. Python is only required if you run the optional local AI model server.

---

## Quick Start for Windows (Recommended)

QuizForge AI includes automated Windows batch scripts for double-click operation from File Explorer:

### 1. First-Time Installation
Double-click **`setup.bat`** (or run `setup.bat` from terminal).
This automated script will:
- Verify that Node.js and npm meet version requirements.
- Automatically create your `.env` configuration file from `.env.example` without overwriting existing settings.
- Install all Node.js dependencies (`npm install`).
- Automatically connect to MySQL, create the `quizforge_ai` database, and apply all tables and migrations.
- Set up the optional Python virtual environment (`ai-service\.venv`) if Python is available.
- Validate that the frontend compiles cleanly (`npm run build`).

### 2. Launch the Application
Double-click **`run.bat`** (or run `run.bat` from terminal).
This will:
- Check that setup has been completed.
- Test that MySQL is online.
- Launch the Frontend (Vite), Backend API (Express), and AI monitor concurrently.
- Keep the terminal open so you can view live server logs.

Access URLs:
- **Web User Interface:** [http://localhost:5173](http://localhost:5173)
- **Backend API Server:** [http://localhost:5000](http://localhost:5000)
- **API Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## Manual Setup (macOS / Linux / Advanced)

If you are on macOS or Linux, or prefer running CLI commands directly:

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-username/quizforge-ai.git
   cd quizforge-ai
   ```

2. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to match your local MySQL username and password if different from defaults.

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Initialize MySQL Database:**
   ```bash
   npm run db:init
   ```

5. **Run Diagnostics (Optional):**
   ```bash
   npm run diagnostics
   ```

6. **Start Application:**
   ```bash
   npm run dev:all
   ```

---

## Configuration (.env)

The application reads configuration from `.env`. The table below outlines every variable:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port for the Express backend API server. |
| `NODE_ENV` | `development` | Runtime environment (`development` or `production`). |
| `DB_HOST` | `localhost` | MySQL hostname or IP address. |
| `DB_PORT` | `3306` | MySQL port number. |
| `DB_USER` | `root` | MySQL user name. |
| `DB_PASSWORD` | *(blank)* | MySQL user password (enter your password if set). |
| `DB_NAME` | `quizforge_ai` | Target database name. |
| `DB_CONNECTION_LIMIT` | `10` | Maximum connections in the MySQL connection pool. |
| `VITE_PORT` | `5173` | Port for the Vite development server. |
| `AI_SERVICE_URL` | `http://localhost:8001` | Optional endpoint URL for the local Qwen AI service. |
| `STATIQ_PROJECT_DIR` | *(blank)* | Optional path to local StatIQ / llama.cpp directory. |

> **Security Note:** Never commit your `.env` file to Git. It is automatically ignored by `.gitignore`.

---

## Running the Application

### Starting Services
- **Windows:** Double-click `run.bat`
- **CLI (All platforms):**
  ```bash
  npm run dev:all
  ```

### Running Components Individually
If you prefer running services in separate terminal windows:
```bash
# Terminal 1 — Backend Express Server (Port 5000)
npm run server

# Terminal 2 — Frontend React/Vite (Port 5173)
npm run dev
```

### Stopping Services
Press `Ctrl + C` in the terminal window running `run.bat` or `npm run dev:all` and type `Y` to terminate all background jobs.

---

## Diagnostics & Verification

To verify that your environment, tools, and database are configured correctly:

- **Windows:** Double-click **`check_setup.bat`**
- **CLI:**
  ```bash
  npm run diagnostics
  ```

The diagnostic script performs 8 comprehensive checks:
1. Node.js runtime and version (>= 18 required)
2. npm package manager presence
3. Git version and repository status
4. Configuration file (`.env`) key validation (without printing secrets)
5. Node dependencies (`node_modules`)
6. MySQL database service connectivity and table count
7. Python runtime and virtual environment status (optional)
8. Port availability (checks if ports 5173 and 5000 are ready)

---

## Updating the Application

When new features or updates are pushed to the GitHub repository:

### Windows (Automated)
Double-click **`update.bat`**.
The update script will:
- Check for remote changes using safe `git pull --ff-only` (never runs destructive resets).
- Preserve your local `.env` settings and existing database data.
- Install any newly introduced dependencies (`npm install`).
- Automatically apply any database schema additions or migrations (`npm run db:init`).

### Manual Update
```bash
git pull
npm install
npm run db:init
npm run build
```

*If you downloaded the project as a ZIP archive:* download the latest release ZIP, extract it into this folder (preserving your `.env` file), and double-click `update.bat`.

---

## Database Management

QuizForge AI includes automated database scripts in the `scripts/` directory:

- **Initialize / Migrate Database:**
  ```bash
  npm run db:init
  ```
  Connects to MySQL, creates `quizforge_ai` if missing, executes `database/schema.sql`, and verifies active attempt uniqueness.

- **Check Database Connectivity:**
  ```bash
  npm run db:check
  ```
  Tests whether MySQL is reachable and verifies table counts.

- **Database Files:**
  - `database/schema.sql`: Authoritative database schema with relational tables:
    - `documents`: Uploaded files and extracted text metadata
    - `quizzes`: Quiz metadata and configurations
    - `questions`: Individual multiple-choice questions
    - `options`: 4 multiple-choice options per question
    - `answer_keys`: Verified correct answer letters and explanations
    - `attempts`: User quiz sessions with status (`in_progress`, `paused`, `completed`, `abandoned`) and unique active attempt enforcement
    - `attempt_answers`: User answer selections per question
    - `tutor_conversations`: Saved AI chat threads per attempt
    - `tutor_messages`: Chat messages exchanged with the AI tutor
  - `database/migrations/`: Standalone SQL migration scripts for version tracking.

---

## Troubleshooting

### 1. "Cannot connect to MySQL server / ECONNREFUSED"
- **Cause:** MySQL service is not running.
- **Solution:**
  - If using XAMPP: Open XAMPP Control Panel and click **Start** next to MySQL.
  - If using Laragon: Click **Start All**.
  - If using Windows Service: Open Command Prompt as Administrator and run `net start MySQL`.
  - Double-click `check_setup.bat` to confirm the connection passes.

### 2. "Access denied for user 'root'@'localhost'"
- **Cause:** Your MySQL server has a root password, but `.env` has `DB_PASSWORD` blank.
- **Solution:**
  - Open `.env` in a text editor.
  - Set `DB_PASSWORD=your_actual_mysql_password`.
  - Run `npm run db:check` to verify.

### 3. "Port 5173 or Port 5000 already in use"
- **Cause:** Another instance of QuizForge AI or another development server is running.
- **Solution:**
  - Close any existing terminal windows running `run.bat` or `npm run dev:all`.
  - Or check listening processes: `netstat -ano | findstr :5173` / `netstat -ano | findstr :5000`.

### 4. "PDF extraction worker failed"
- **Cause:** PDF.js CDN blocked or offline.
- **Solution:** QuizForge AI bundles a local PDF.js worker located in `public/pdf.worker.min.mjs` and Vite assets. Ensure all dependencies were installed via `setup.bat`.

### 5. "Local AI tutor is unavailable"
- **Note:** The local AI tutor requires running the optional Qwen LLM model.
- If you do not have local LLM weights configured, the core document upload, quiz generation, interactive quiz player, scoring, attempts, and history work completely normally without it!

---

## Security Guidelines

- **Never commit `.env`:** Keep all API keys, database passwords, and secrets strictly in `.env`.
- **Reproducible Dependencies:** Always commit `package-lock.json` when adding packages, but never commit `node_modules` or `.venv`.
- **Database Backups:** Use standard MySQL dumps (`mysqldump -u root -p quizforge_ai > backup.sql`) before major production database changes.

---

## Contributing

1. Fork or branch from the main repository.
2. Run `check_setup.bat` to verify your environment.
3. Make changes and verify frontend build passes (`npm run build`).
4. Ensure code formatting is clean (`npm run lint`).
5. Submit a pull request with a description of changes.

---

## License

This project is licensed under the MIT License.
