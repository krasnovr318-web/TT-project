# quiz_backend.py - ВЕРСИЯ ДЛЯ SUPABASE
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List
import uuid
import os
import json
import asyncpg
from datetime import datetime
from contextlib import asynccontextmanager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# ПОДКЛЮЧЕНИЕ К SUPABASE
# ============================================
DATABASE_URL = os.environ.get("DATABASE_URL", "")
db_pool = None


async def init_database():
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)

        async with db_pool.acquire() as conn:
            # Таблица пользователей
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Таблица викторин
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS quizzes (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    questions TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Таблица попыток
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS attempts (
                    id TEXT PRIMARY KEY,
                    quiz_id TEXT NOT NULL,
                    user_id TEXT,
                    score INTEGER DEFAULT 0,
                    finished INTEGER DEFAULT 0,
                    answers TEXT,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

        print("✅ Supabase подключен! Таблицы созданы.")
    except Exception as e:
        print(f"❌ Ошибка подключения к Supabase: {e}")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    await init_database()
    print("🚀 Сервер запущен")
    yield
    # SHUTDOWN
    if db_pool:
        await db_pool.close()
        print("🔌 Соединение с Supabase закрыто")


app = FastAPI(lifespan=lifespan)

# Добавляем CORS после создания app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# МОДЕЛИ ДАННЫХ
# ============================================
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


# ============================================
# ОТДАЧА ФАЙЛОВ
# ============================================
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


# ============================================
# API ПОЛЬЗОВАТЕЛЕЙ
# ============================================
@app.post("/register")
async def register(user: UserRegister):
    async with db_pool.acquire() as conn:
        # Проверяем, существует ли пользователь
        existing = await conn.fetchval("SELECT id FROM users WHERE username = $1", user.username)
        if existing:
            raise HTTPException(status_code=400, detail="Пользователь уже существует")

        user_id = str(uuid.uuid4())[:8]
        await conn.execute(
            "INSERT INTO users (id, username, password) VALUES ($1, $2, $3)",
            user_id, user.username, user.password
        )

    return {"success": True, "user_id": user_id, "username": user.username}


@app.post("/login")
async def login(user: UserLogin):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, username FROM users WHERE username = $1 AND password = $2",
            user.username, user.password
        )

        if not row:
            raise HTTPException(status_code=401, detail="Неверное имя или пароль")

        return {"success": True, "user_id": row["id"], "username": row["username"]}


# ============================================
# API ВИКТОРИН
# ============================================
@app.post("/create_quiz")
async def create_quiz(quiz_data: QuizData, request: Request):
    user_id = request.query_params.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    # Проверяем существование пользователя
    async with db_pool.acquire() as conn:
        exists = await conn.fetchval("SELECT id FROM users WHERE id = $1", user_id)
        if not exists:
            raise HTTPException(status_code=401, detail="Пользователь не найден")

    quiz_id = str(uuid.uuid4())[:8]
    questions_json = json.dumps([q.dict() for q in quiz_data.questions], ensure_ascii=False)

    async with db_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO quizzes (id, user_id, title, questions) VALUES ($1, $2, $3, $4)",
            quiz_id, user_id, quiz_data.title, questions_json
        )

    print(f"✅ Создана викторина: {quiz_id} - {quiz_data.title}")
    return {"quiz_id": quiz_id, "title": quiz_data.title}


@app.get("/quiz/{quiz_id}")
async def get_quiz(quiz_id: str):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM quizzes WHERE id = $1", quiz_id)

    if not row:
        raise HTTPException(status_code=404, detail="Викторина не найдена")

    questions = json.loads(row["questions"])

    return {
        "id": row["id"],
        "title": row["title"],
        "questions": [
            {
                "text": q["text"],
                "options": q["options"],
                "time_limit": q.get("time_limit", 30)
            }
            for q in questions
        ]
    }


@app.get("/my_quizzes")
async def get_my_quizzes(request: Request):
    user_id = request.query_params.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, title, created_at FROM quizzes WHERE user_id = $1 ORDER BY created_at DESC",
            user_id
        )

    return [{"id": r["id"], "title": r["title"], "created_at": r["created_at"].isoformat()} for r in rows]


@app.delete("/delete_quiz/{quiz_id}")
async def delete_quiz(quiz_id: str, request: Request):
    user_id = request.query_params.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    async with db_pool.acquire() as conn:
        # Проверяем права
        owner = await conn.fetchval(
            "SELECT user_id FROM quizzes WHERE id = $1",
            quiz_id
        )
        if not owner:
            raise HTTPException(status_code=404, detail="Викторина не найдена")
        if owner != user_id:
            raise HTTPException(status_code=403, detail="Нет прав на удаление")

        await conn.execute("DELETE FROM quizzes WHERE id = $1", quiz_id)

    return {"success": True, "message": "Викторина удалена"}


@app.delete("/delete_all_quizzes")
async def delete_all_quizzes(request: Request):
    user_id = request.query_params.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM quizzes WHERE user_id = $1", user_id)

    return {"success": True, "message": "Все викторины удалены"}


# ============================================
# API ПРОХОЖДЕНИЯ
# ============================================
@app.post("/start_quiz/{quiz_id}")
async def start_quiz(quiz_id: str, request: Request):
    user_id = request.query_params.get("user_id")

    async with db_pool.acquire() as conn:
        exists = await conn.fetchval("SELECT id FROM quizzes WHERE id = $1", quiz_id)
        if not exists:
            raise HTTPException(status_code=404, detail="Викторина не найдена")

    attempt_id = str(uuid.uuid4())[:8]

    async with db_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO attempts (id, quiz_id, user_id, score, finished, answers) VALUES ($1, $2, $3, $4, $5, $6)",
            attempt_id, quiz_id, user_id, 0, 0, json.dumps([])
        )

    return {"attempt_id": attempt_id}


@app.post("/answer/{attempt_id}")
async def submit_answer(attempt_id: str, data: dict):
    async with db_pool.acquire() as conn:
        attempt = await conn.fetchrow("SELECT * FROM attempts WHERE id = $1", attempt_id)

    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    if attempt["finished"] == 1:
        raise HTTPException(status_code=400, detail="Викторина завершена")

    async with db_pool.acquire() as conn:
        quiz = await conn.fetchrow("SELECT * FROM quizzes WHERE id = $1", attempt["quiz_id"])

    questions = json.loads(quiz["questions"])
    question_index = data["question_index"]
    user_answer = data["answer"]
    correct_answer = questions[question_index]["correct"]
    is_correct = (user_answer == correct_answer)

    answers = json.loads(attempt["answers"]) if attempt["answers"] else []
    answers.append({
        "question_index": question_index,
        "answer": user_answer,
        "is_correct": is_correct
    })

    new_score = attempt["score"] + (1 if is_correct else 0)

    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE attempts SET score = $1, answers = $2 WHERE id = $3",
            new_score, json.dumps(answers), attempt_id
        )

    return {"correct": is_correct, "score": new_score}


@app.post("/finish_quiz/{attempt_id}")
async def finish_quiz(attempt_id: str):
    async with db_pool.acquire() as conn:
        attempt = await conn.fetchrow("SELECT * FROM attempts WHERE id = $1", attempt_id)

    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    async with db_pool.acquire() as conn:
        quiz = await conn.fetchrow("SELECT * FROM quizzes WHERE id = $1", attempt["quiz_id"])

    questions = json.loads(quiz["questions"])
    total_questions = len(questions)
    percentage = int((attempt["score"] / total_questions) * 100) if total_questions > 0 else 0

    async with db_pool.acquire() as conn:
        await conn.execute("UPDATE attempts SET finished = 1 WHERE id = $1", attempt_id)

    return {
        "score": attempt["score"],
        "total": total_questions,
        "percentage": percentage
    }


# ============================================
# СТАТИСТИКА
# ============================================
@app.get("/admin/stats")
async def get_stats():
    async with db_pool.acquire() as conn:
        users_count = await conn.fetchval("SELECT COUNT(*) FROM users")
        quizzes_count = await conn.fetchval("SELECT COUNT(*) FROM quizzes")
        attempts_count = await conn.fetchval("SELECT COUNT(*) FROM attempts WHERE finished = 1")
        avg_score = await conn.fetchval("SELECT AVG(score) FROM attempts WHERE finished = 1") or 0

    return {
        "total_users": users_count,
        "total_quizzes": quizzes_count,
        "total_attempts": attempts_count,
        "average_score": round(avg_score, 2)
    }


@app.get("/health")
async def health_check():
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    print("=" * 50)
    print("🎯 TikTok Викторина Челлендж (Supabase)")
    print("=" * 50)
    print(f"✅ Сервер: http://localhost:{port}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=port)