# quiz_backend.py - ПОЛНАЯ ВЕРСИЯ
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List
import uuid
import os
import json
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ХРАНИЛИЩЕ ДАННЫХ (в памяти)
users_db = {}
quizzes_db = {}
attempts_db = {}


# МОДЕЛИ ДАННЫХ
class Question(BaseModel):
    text: str
    options: List[str]
    correct: int
    time_limit: int = 30


class QuizData(BaseModel):
    title: str
    questions: List[Question]


class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


# ОТДАЧА ФАЙЛОВ
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


# API ПОЛЬЗОВАТЕЛЕЙ
@app.post("/register")
async def register(user: UserRegister):
    for uid, u in users_db.items():
        if u["username"] == user.username:
            raise HTTPException(status_code=400, detail="Пользователь уже существует")

    user_id = str(uuid.uuid4())[:8]
    users_db[user_id] = {
        "id": user_id,
        "username": user.username,
        "password": user.password,
        "created_at": datetime.now().isoformat()
    }
    return {"success": True, "user_id": user_id, "username": user.username}


@app.post("/login")
async def login(user: UserLogin):
    for uid, u in users_db.items():
        if u["username"] == user.username and u["password"] == user.password:
            return {"success": True, "user_id": uid, "username": user.username}
    raise HTTPException(status_code=401, detail="Неверное имя или пароль")


# API ВИКТОРИН
@app.post("/create_quiz")
async def create_quiz(quiz_data: QuizData, request: Request):
    user_id = request.query_params.get("user_id")
    if not user_id or user_id not in users_db:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    quiz_id = str(uuid.uuid4())[:8]
    quizzes_db[quiz_id] = {
        "id": quiz_id,
        "user_id": user_id,
        "title": quiz_data.title,
        "questions": [q.dict() for q in quiz_data.questions],
        "created_at": datetime.now().isoformat()
    }
    return {"quiz_id": quiz_id, "title": quiz_data.title}


@app.get("/quiz/{quiz_id}")
async def get_quiz(quiz_id: str):
    quiz = quizzes_db.get(quiz_id)
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


@app.get("/my_quizzes")
async def get_my_quizzes(request: Request):
    user_id = request.query_params.get("user_id")
    if not user_id or user_id not in users_db:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    my_quizzes = []
    for quiz_id, quiz in quizzes_db.items():
        if quiz["user_id"] == user_id:
            my_quizzes.append({
                "id": quiz["id"],
                "title": quiz["title"],
                "created_at": quiz["created_at"]
            })
    return my_quizzes


@app.delete("/delete_quiz/{quiz_id}")
async def delete_quiz(quiz_id: str, request: Request):
    user_id = request.query_params.get("user_id")
    quiz = quizzes_db.get(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Викторина не найдена")
    if quiz["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Нет прав на удаление")
    del quizzes_db[quiz_id]
    return {"success": True}


@app.delete("/delete_all_quizzes")
async def delete_all_quizzes(request: Request):
    user_id = request.query_params.get("user_id")
    to_delete = []
    for quiz_id, quiz in quizzes_db.items():
        if quiz["user_id"] == user_id:
            to_delete.append(quiz_id)
    for quiz_id in to_delete:
        del quizzes_db[quiz_id]
    return {"success": True, "deleted": len(to_delete)}


# API ПРОХОЖДЕНИЯ
@app.post("/start_quiz/{quiz_id}")
async def start_quiz(quiz_id: str, request: Request):
    user_id = request.query_params.get("user_id")
    if quiz_id not in quizzes_db:
        raise HTTPException(status_code=404, detail="Викторина не найдена")

    attempt_id = str(uuid.uuid4())[:8]
    attempts_db[attempt_id] = {
        "id": attempt_id,
        "quiz_id": quiz_id,
        "user_id": user_id,
        "answers": [],
        "score": 0,
        "finished": 0,
        "started_at": datetime.now().isoformat()
    }
    return {"attempt_id": attempt_id}


@app.post("/answer/{attempt_id}")
async def submit_answer(attempt_id: str, data: dict):
    attempt = attempts_db.get(attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")
    if attempt["finished"] == 1:
        raise HTTPException(status_code=400, detail="Викторина завершена")

    quiz = quizzes_db.get(attempt["quiz_id"])
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
    attempt = attempts_db.get(attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    quiz = quizzes_db.get(attempt["quiz_id"])
    total = len(quiz["questions"])
    attempt["finished"] = 1
    percentage = int((attempt["score"] / total) * 100) if total > 0 else 0
    return {"score": attempt["score"], "total": total, "percentage": percentage}


@app.get("/admin/stats")
async def get_stats():
    return {
        "total_users": len(users_db),
        "total_quizzes": len(quizzes_db),
        "total_attempts": len(attempts_db),
        "average_score": 0
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    print("=" * 50)
    print("🎯 TikTok Викторина Челлендж")
    print("=" * 50)
    print(f"✅ Сервер: http://localhost:{port}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=port)