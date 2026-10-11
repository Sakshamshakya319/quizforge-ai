from pydantic import BaseModel, Field
from typing import List, Optional

class Message(BaseModel):
    role: str
    content: str

class TutorRequest(BaseModel):
    question_text: str = Field(..., description="The original question")
    answer_options: Optional[List[str]] = Field(default=[], description="Available answer options")
    user_selected_answer: Optional[str] = Field(default=None, description="The user's selected option")
    verified_correct_answer: Optional[str] = Field(default=None, description="The correct answer, if verified")
    source_explanation: Optional[str] = Field(default=None, description="Original explanation from document")
    conversation_history: List[Message] = Field(default_factory=list, description="Past messages in this session")
    follow_up_question: Optional[str] = Field(default=None, description="User's new message if it's a follow-up")

class TutorResponse(BaseModel):
    role: str
    content: str

class GenerateQuizRequest(BaseModel):
    content: str = Field(..., description="The source educational text")
    num_questions: int = Field(default=5)
    num_options: int = Field(default=4)
    difficulty: str = Field(default="Medium")
    topic: Optional[str] = Field(default=None)

class GeneratedOption(BaseModel):
    label: str
    text: str

class GeneratedQuestion(BaseModel):
    questionText: str
    options: List[GeneratedOption]
    correctOptionLabel: str
    explanation: str
    verificationStatus: str = "needs_review"

class GenerateQuizResponse(BaseModel):
    questions: List[GeneratedQuestion]
