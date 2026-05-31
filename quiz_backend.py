# quiz_backend.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List
import uuid
import os
import asyncpg
import json
from contextlib import asynccontextmanager

# ============================================
# НАСТРОЙКА ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ
# ============================================
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:password@localhost:5432/postgres")

# Глобальные переменные
db_pool = None


# ============================================
# LIFESPAN (НОВЫЙ СПОСОБ ВМЕСТО on_event)
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP: выполняется при запуске
    global db_pool
    print("🚀 Запуск сервера...")

    # Подключаемся к Supabase
    try:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
        print("✅ Подключено к Supabase!")

        # Создаем таблицы
        async with db_pool.acquire() as conn:
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS quizzes (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    questions TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS attempts (
                    id TEXT PRIMARY KEY,
                    quiz_id TEXT NOT NULL,
                    answers TEXT,
                    score INTEGER DEFAULT 0,
                    finished INTEGER DEFAULT 0,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        print("✅ Таблицы созданы/проверены")

    except Exception as e:
        print(f"❌ Ошибка подключения к Supabase: {e}")
        print("⚠️ ПРОВЕРЬТЕ переменную окружения DATABASE_URL")
        raise

    yield  # Здесь приложение работает

    # SHUTDOWN: выполняется при остановке
    print("🛑 Остановка сервера...")
    if db_pool:
        await db_pool.close()
        print("🔌 Соединение с БД закрыто")


# Создаем приложение с lifespan
app = FastAPI(lifespan=lifespan)

# Разрешаем CORS
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


# ============================================
# ОТДАЧА ФАЙЛОВ
# ============================================
@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>index.html не найден</h1>")


@app.get("/style.css")
async def serve_css():
    try:
        with open("style.css", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), media_type="text/css")
    except FileNotFoundError:
        return HTMLResponse(content="", media_type="text/css")


@app.get("/script.js")
async def serve_js():
    try:
        with open("script.js", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), media_type="application/javascript")
    except FileNotFoundError:
        return HTMLResponse(content="", media_type="application/javascript")


# ============================================
# API ДЛЯ ВИКТОРИН
# ============================================
@app.post("/create_quiz")
async def create_quiz(quiz_data: QuizData):
    quiz_id = str(uuid.uuid4())[:8]
    questions_json = json.dumps([q.dict() for q in quiz_data.questions], ensure_ascii=False)

    async with db_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO quizzes (id, title, questions) VALUES ($1, $2, $3)",
            quiz_id, quiz_data.title, questions_json
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


@app.get("/all_quizzes")
async def get_all_quizzes():
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, title, created_at FROM quizzes ORDER BY created_at DESC")

    return [{"id": r["id"], "title": r["title"], "created_at": str(r["created_at"])} for r in rows]


@app.delete("/delete_quiz/{quiz_id}")
async def delete_quiz(quiz_id: str):
    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM quizzes WHERE id = $1", quiz_id)
        await conn.execute("DELETE FROM attempts WHERE quiz_id = $1", quiz_id)

    return {"success": True, "message": "Викторина удалена"}


# ============================================
# API ДЛЯ ПРОХОЖДЕНИЯ
# ============================================
@app.post("/start_quiz/{quiz_id}")
async def start_quiz(quiz_id: str):
    # Проверяем существование викторины
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM quizzes WHERE id = $1", quiz_id)

    if not row:
        raise HTTPException(status_code=404, detail="Викторина не найдена")

    attempt_id = str(uuid.uuid4())[:8]

    async with db_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO attempts (id, quiz_id, score, finished, answers) VALUES ($1, $2, $3, $4, $5)",
            attempt_id, quiz_id, 0, 0, json.dumps([])
        )

    print(f"🎮 Начата попытка: {attempt_id}")
    return {"attempt_id": attempt_id}


@app.post("/answer/{attempt_id}")
async def submit_answer(attempt_id: str, data: dict):
    async with db_pool.acquire() as conn:
        attempt = await conn.fetchrow("SELECT * FROM attempts WHERE id = $1", attempt_id)

    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    if attempt["finished"] == 1:
        raise HTTPException(status_code=400, detail="Викторина завершена")

    # Получаем вопросы викторины
    async with db_pool.acquire() as conn:
        quiz = await conn.fetchrow("SELECT * FROM quizzes WHERE id = $1", attempt["quiz_id"])

    questions = json.loads(quiz["questions"])
    question = questions[data["question_index"]]
    is_correct = (data["answer"] == question["correct"])

    # Сохраняем ответ
    answers = json.loads(attempt["answers"]) if attempt["answers"] else []
    answers.append({
        "question_index": data["question_index"],
        "answer": data["answer"],
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
    total = len(questions)
    percentage = int((attempt["score"] / total) * 100) if total > 0 else 0

    async with db_pool.acquire() as conn:
        await conn.execute("UPDATE attempts SET finished = 1 WHERE id = $1", attempt_id)

    print(f"🏆 Завершена попытка {attempt_id}: {attempt['score']}/{total}")

    return {
        "score": attempt["score"],
        "total": total,
        "percentage": percentage
    }


# ============================================
# СТАТИСТИКА
# ============================================
@app.get("/stats")
async def get_stats():
    async with db_pool.acquire() as conn:
        quizzes_count = await conn.fetchval("SELECT COUNT(*) FROM quizzes")
        attempts_count = await conn.fetchval("SELECT COUNT(*) FROM attempts WHERE finished = 1")
        avg_score = await conn.fetchval("SELECT AVG(score) FROM attempts WHERE finished = 1")

    return {
        "total_quizzes": quizzes_count,
        "total_attempts": attempts_count,
        "average_score": round(avg_score or 0, 2)
    }


@app.get("/health")
async def health_check():
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except:
        return {"status": "error", "database": "disconnected"}


# ============================================
# ЗАПУСК СЕРВЕРА (только для локального теста)
# ============================================
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    print("=" * 50)
    print("🎯 TikTok Викторина Челлендж")
    print("=" * 50)
    print(f"✅ Сервер: http://localhost:{port}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=port)