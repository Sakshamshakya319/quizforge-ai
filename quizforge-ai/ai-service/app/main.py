from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import tutor

app = FastAPI(
    title="QuizForge AI Service",
    description="Integrated AI serving infrastructure for QuizForge",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tutor.router, prefix="/api/v1/tutor", tags=["tutor"])

@app.get("/health")
def health_check():
    """
    Health check to ensure FastAPI is running.
    We don't ping llama-server here to avoid hanging the health check if inference is busy.
    """
    return {
        "status": "healthy",
        "service": "quizforge-ai-service"
    }

@app.get("/")
def root():
    return {"message": "QuizForge AI Service is running."}
