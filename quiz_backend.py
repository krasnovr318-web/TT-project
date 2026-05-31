# quiz_backend.py - ВЕРСИЯ БЕЗ БАЗЫ ДАННЫХ (для теста)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List
import uuid
import os
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Хранилище в памяти (данные теряются при перезапуске)
quizzes = {}
attempts = {}

class Question(BaseModel):
    text: str
    options: List[str]
    correct: int
    time_limit: int = 30

class QuizData(BaseModel):
    title: str
    questions: List[Question]

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except:
        return HTMLResponse(content="<h1>index.html не найден</h1>")

@app.get("/style.css")
async def serve_css():
    try:
        with open("style.css", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), media_type="text/css")
    except:
        return HTMLResponse(content="", media_type="text/css")

@app.get("/script.js")
async def serve_js():
    try:
        with open("script.js", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), media_type="application/javascript")
    except:
        return HTMLResponse(content="", media_type="application/javascript")

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
    return {
        "id": quiz["id"],
        "title": quiz["title"],
        "questions": [
            {"text": q["text"], "options": q["options"], "time_limit": q.get("time_limit", 30)}
            for q in quiz["questions"]
        ]
    }

@app.post("/start_quiz/{quiz_id}")
async def start_quiz(quiz_id: str):
    if quiz_id not in quizzes:
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
    question = quiz["questions"][data["question_index"]]
    is_correct = (data["answer"] == question["correct"])
    attempt["answers"].append({
        "question_index": data["question_index"],
        "answer": data["answer"],
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
    total = len(quiz["questions"])
    attempt["finished"] = True
    percentage = int((attempt["score"] / total) * 100) if total > 0 else 0
    return {
        "score": attempt["score"],
        "total": total,
        "percentage": percentage
    }

@app.get("/health")
async def health():
    return {"status": "ok", "quizzes": len(quizzes)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print("=" * 50)
    print("🎯 TikTok Викторина (без БД)")
    print("=" * 50)
    print(f"✅ Сервер: http://localhost:{port}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=port)