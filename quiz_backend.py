# quiz_backend.py - ВЕРСИЯ ДЛЯ RENDER (psycopg2 вместо asyncpg)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List
import uuid
import os
import psycopg2
import psycopg2.extras
import json
from contextlib import contextmanager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ (psycopg2)
# ============================================
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:password@localhost:5432/postgres")


@contextmanager
def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Таблица викторин
                cur.execute('''
                    CREATE TABLE IF NOT EXISTS quizzes (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        questions TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                # Таблица попыток
                cur.execute('''
                    CREATE TABLE IF NOT EXISTS attempts (
                        id TEXT PRIMARY KEY,
                        quiz_id TEXT NOT NULL,
                        answers TEXT,
                        score INTEGER DEFAULT 0,
                        finished INTEGER DEFAULT 0,
                        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                # Таблица пользователей (опционально)
                cur.execute('''
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        username TEXT UNIQUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
        print("✅ Таблицы созданы/проверены")
    except Exception as e:
        print(f"❌ Ошибка инициализации БД: {e}")
        raise


# Инициализация БД при запуске
init_database()


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
# API ДЛЯ ВИКТОРИН
# ============================================
@app.post("/create_quiz")
async def create_quiz(quiz_data: QuizData):
    quiz_id = str(uuid.uuid4())[:8]
    questions_json = json.dumps([q.dict() for q in quiz_data.questions], ensure_ascii=False)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO quizzes (id, title, questions) VALUES (%s, %s, %s)",
                (quiz_id, quiz_data.title, questions_json)
            )

    print(f"✅ Создана викторина: {quiz_id}")
    return {"quiz_id": quiz_id, "title": quiz_data.title}


@app.get("/quiz/{quiz_id}")
async def get_quiz(quiz_id: str):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM quizzes WHERE id = %s", (quiz_id,))
            row = cur.fetchone()

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


@app.post("/start_quiz/{quiz_id}")
async def start_quiz(quiz_id: str):
    # Проверяем существование викторины
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM quizzes WHERE id = %s", (quiz_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Викторина не найдена")

    attempt_id = str(uuid.uuid4())[:8]

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO attempts (id, quiz_id, score, finished, answers) VALUES (%s, %s, %s, %s, %s)",
                (attempt_id, quiz_id, 0, 0, json.dumps([]))
            )

    return {"attempt_id": attempt_id}


@app.post("/answer/{attempt_id}")
async def submit_answer(attempt_id: str, data: dict):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM attempts WHERE id = %s", (attempt_id,))
            attempt = cur.fetchone()

    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    if attempt["finished"] == 1:
        raise HTTPException(status_code=400, detail="Викторина завершена")

    # Получаем вопросы викторины
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM quizzes WHERE id = %s", (attempt["quiz_id"],))
            quiz = cur.fetchone()

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

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE attempts SET score = %s, answers = %s WHERE id = %s",
                (new_score, json.dumps(answers), attempt_id)
            )

    return {"correct": is_correct, "score": new_score}


@app.post("/finish_quiz/{attempt_id}")
async def finish_quiz(attempt_id: str):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM attempts WHERE id = %s", (attempt_id,))
            attempt = cur.fetchone()

    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM quizzes WHERE id = %s", (attempt["quiz_id"],))
            quiz = cur.fetchone()

    questions = json.loads(quiz["questions"])
    total = len(questions)
    percentage = int((attempt["score"] / total) * 100) if total > 0 else 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE attempts SET finished = 1 WHERE id = %s", (attempt_id,))

    return {
        "score": attempt["score"],
        "total": total,
        "percentage": percentage
    }


@app.get("/health")
async def health_check():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    print("=" * 50)
    print("🎯 TikTok Викторина Челлендж")
    print("=" * 50)
    print(f"✅ Сервер: http://localhost:{port}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=port)