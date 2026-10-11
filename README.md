# QuizForge AI — Smart Document-to-Quiz Platform

QuizForge AI is an intelligent educational platform that converts documents (`.pdf`, `.docx`, `.pptx`) and study notes into interactive multiple-choice quizzes. It features automated question extraction, an interactive quiz player with pause and resume support, detailed test analytics with downloadable PDF reports, and an integrated local AI tutor to explain mistakes.

---

## Quick Start for Windows (1-Click Setup)

1. **First-Time Setup:**
   Double-click **`setup.bat`** (or `quizforge-ai\setup.bat`).
   This will:
   - Check Node.js (v18+) and npm.
   - Create `.env` from template.
   - Install all dependencies (`npm install`).
   - Automatically initialize the MySQL database and schema.
   - Set up the optional Python virtual environment.
   - Validate that the frontend compiles cleanly.

2. **Launch Application:**
   Double-click **`run.bat`** (or `quizforge-ai\run.bat`).
   - Web Application: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:5000](http://localhost:5000)

3. **Check System Diagnostics:**
   Double-click **`check_setup.bat`** anytime to verify MySQL, dependencies, and environment status.

4. **Update Application:**
   Double-click **`update.bat`** to pull latest updates safely without overwriting your local configuration.

---

For detailed documentation, technology stack, environment variables, and troubleshooting guides, please see:
[quizforge-ai/README.md](quizforge-ai/README.md)
