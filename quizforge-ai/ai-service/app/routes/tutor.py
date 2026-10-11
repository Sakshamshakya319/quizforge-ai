from fastapi import APIRouter, HTTPException
from app.schemas.tutor import TutorRequest, TutorResponse
from app.services.inference import generate_chat_completion

router = APIRouter()

def build_system_prompt(request: TutorRequest) -> str:
    prompt = (
        "You are an expert AI tutor inside the QuizForge educational application. "
        "Your role is to help students understand their multiple-choice quiz results.\n\n"
        f"Question: {request.question_text}\n"
    )
    
    if request.answer_options:
        prompt += "Options:\n"
        for i, opt in enumerate(request.answer_options):
            prompt += f"- {opt}\n"
            
    if request.user_selected_answer:
        prompt += f"\nThe student selected: {request.user_selected_answer}\n"
        
    if request.verified_correct_answer:
        prompt += f"The verified correct answer is: {request.verified_correct_answer}\n"
        prompt += (
            "\nProvide a clear, encouraging explanation following these rules:\n"
            "1. Explain why the student's selected answer is correct or incorrect.\n"
            "2. Explain why the verified correct answer is correct.\n"
            "3. Explain the underlying educational concept clearly.\n"
            "4. Provide a simple example or memory aid if useful.\n"
        )
    else:
        prompt += (
            "\nThere is no verified correct answer for this question. Do not invent a definitive answer key. "
            "Instead, guide the student through analyzing the options and discuss the educational concepts involved.\n"
        )
        
    if request.source_explanation:
        prompt += f"\nFor reference, the source document included this explanation: {request.source_explanation}\n"
        
    return prompt

@router.post("/chat", response_model=TutorResponse)
async def tutor_chat(request: TutorRequest):
    try:
        messages = []
        
        # We start with the robust system prompt setting up the context
        messages.append({
            "role": "system", 
            "content": build_system_prompt(request)
        })
        
        # Add history
        for msg in request.conversation_history:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
            
        # Add the new message if this is a follow-up, otherwise if history is empty and no follow-up, 
        # we trigger the first explanation by pretending the user asked for one.
        if request.follow_up_question:
            messages.append({"role": "user", "content": request.follow_up_question})
        elif not request.conversation_history:
            messages.append({"role": "user", "content": "Can you explain this question and my answer?"})
            
        # Call llama-server
        response_text = await generate_chat_completion(messages, temperature=0.3, max_tokens=1024)
        
        return TutorResponse(role="assistant", content=response_text.strip())
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import json
from app.schemas.tutor import GenerateQuizRequest, GenerateQuizResponse, GeneratedQuestion

@router.post("/generate", response_model=GenerateQuizResponse)
async def generate_quiz(request: GenerateQuizRequest):
    try:
        topic_str = f" focused on {request.topic}" if request.topic else ""
        
        # We estimate ~4 chars per token.
        # Max context is 8192. We need ~2500 for output and ~500 for system prompt.
        # So max input tokens ~ 5000, which is ~20,000 chars.
        # To be safe, we split content into chunks of 15,000 characters.
        CHUNK_SIZE = 15000
        content = request.content.strip()
        
        chunks = []
        if len(content) > CHUNK_SIZE:
            # simple chunking by size
            for i in range(0, len(content), CHUNK_SIZE):
                chunks.append(content[i:i+CHUNK_SIZE])
        else:
            chunks.append(content)
            
        # Distribute the requested number of questions across chunks
        total_requested = request.num_questions
        questions_per_chunk = max(1, total_requested // len(chunks))
        remainder = total_requested % len(chunks)

        all_generated_questions = []

        for idx, chunk in enumerate(chunks):
            chunk_target = questions_per_chunk + (1 if idx < remainder else 0)
            if chunk_target == 0:
                continue

            system_prompt = (
                "You are an expert educational content creator. Your task is to generate a JSON array of multiple-choice questions "
                f"based strictly on the provided text. Generate exactly {chunk_target} questions{topic_str}, with a difficulty level of {request.difficulty}. "
                f"Each question must have exactly {request.num_options} options (labeled A, B, C, D, etc).\n\n"
                "Format your response as a valid JSON object matching this schema exactly:\n"
                "{\n"
                '  "questions": [\n'
                "    {\n"
                '      "questionText": "What does HTML stand for?",\n'
                '      "options": [\n'
                '        {"label": "A", "text": "HyperText Markup Language"},\n'
                '        {"label": "B", "text": "HighText Machine Language"},\n'
                '        {"label": "C", "text": "HyperTransfer Markup Language"},\n'
                '        {"label": "D", "text": "Home Tool Markup Language"}\n'
                "      ],\n"
                '      "correctOptionLabel": "A",\n'
                '      "explanation": "HTML stands for HyperText Markup Language."\n'
                "    }\n"
                "  ]\n"
                "}\n\n"
                "DO NOT include any markdown formatting, backticks, or other text outside the JSON object. Only return the raw JSON object."
            )
            
            user_prompt = f"Generate {chunk_target} questions based on this text:\n\n{chunk}"
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            # Request up to 3000 tokens for generation just in case
            response_text = await generate_chat_completion(messages, temperature=0.3, max_tokens=3000)
            
            # Strip markdown code blocks if the model insists on adding them
            cleaned_response = response_text.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
                
            try:
                data = json.loads(cleaned_response.strip())
                batch_qs = data.get("questions", [])
                all_generated_questions.extend(batch_qs)
            except json.JSONDecodeError as e:
                # If a chunk fails, we log it but continue processing the other chunks
                print(f"Batch {idx+1} JSON decode failed: {str(e)}")
                continue

        # Enforce validation on the aggregated result
        if not all_generated_questions:
            raise Exception("The model failed to generate any valid questions from the provided content.")
            
        return GenerateQuizResponse(questions=all_generated_questions)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
