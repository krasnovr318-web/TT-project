# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List
import uuid
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

quizzes = {}
attempts = {}

class Question(BaseModel):
    text: str
    options: List[str]
    correct: int

class QuizData(BaseModel):
    title: str
    questions: List[Question]

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    with open("index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/style.css")
async def serve_css():
    with open("style.css", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read(), media_type="text/css")

@app.get("/script.js")
async def serve_js():
    with open("script.js", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read(), media_type="application/javascript")

@app.post("/create_quiz")
async def create_quiz(quiz_data: QuizData):
    quiz_id = str(uuid.uuid4())[:8]
    quizzes[quiz_id] = {
        "id": quiz_id,
        "title": quiz_data.title,
        "questions": [q.dict() for q in quiz_data.questions]
    }
    return {"quiz_id": quiz_id, "title": quiz_data.title}

@app.get("/quiz/{quiz_id}")
async def get_quiz(quiz_id: str):
    quiz = quizzes.get(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Викторина не найдена")
    public_quiz = {
        "id": quiz["id"],
        "title": quiz["title"],
        "questions": [
            {"text": q["text"], "options": q["options"]}
            for q in quiz["questions"]
        ]
    }
    return public_quiz

@app.post("/start_quiz/{quiz_id}")
async def start_quiz(quiz_id: str):
    quiz = quizzes.get(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Викторина не найдена")
    attempt_id = str(uuid.uuid4())[:8]
    attempts[attempt_id] = {
        "id": attempt_id,
        "quiz_id": quiz_id,
        "answers": [],
        "score": 0,
        "finished": False
    }
    return {"attempt_id": attempt_id}

@app.post("/answer/{attempt_id}")
async def submit_answer(attempt_id: str, data: dict):
    attempt = attempts.get(attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")
    if attempt["finished"]:
        raise HTTPException(status_code=400, detail="Викторина завершена")
    quiz = quizzes.get(attempt["quiz_id"])
    question_index = data["question_index"]
    user_answer = data["answer"]
    correct_answer = quiz["questions"][question_index]["correct"]
    is_correct = (user_answer == correct_answer)
    attempt["answers"].append({
        "question": question_index,
        "user_answer": user_answer,
        "is_correct": is_correct
    })
    if is_correct:
        attempt["score"] += 1
    return {"correct": is_correct, "score": attempt["score"]}

@app.post("/finish_quiz/{attempt_id}")
async def finish_quiz(attempt_id: str):
    attempt = attempts.get(attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")
    quiz = quizzes.get(attempt["quiz_id"])
    total_questions = len(quiz["questions"])
    attempt["finished"] = True
    result = {
        "score": attempt["score"],
        "total": total_questions,
        "percentage": int((attempt["score"] / total_questions) * 100)
    }
    return result

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print("=" * 50)
    print("🎯 TikTok Викторина Челлендж")
    print("=" * 50)
    print(f"Сервер запущен на http://localhost:{port}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=port)