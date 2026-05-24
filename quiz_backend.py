# quiz_backend.py - ПОЛНАЯ ВЕРСИЯ
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List
import uuid
import sqlite3
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
# АДМИН НАСТРОЙКИ (ИЗМЕНИТЕ ПАРОЛЬ!)
# ============================================
ADMIN_PASSWORD = "a2010Dmin2026"  # <- ИЗМЕНИТЕ ЭТОТ ПАРОЛЬ НА СВОЙ!

# ============================================
# БАЗА ДАННЫХ
# ============================================
DATABASE_FILE = "quiz_database.db"


@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_database():
    with get_db() as conn:
        cursor = conn.cursor()

        try:
            cursor.execute("ALTER TABLE quizzes ADD COLUMN user_id TEXT")
            print("✅ Добавлена колонка user_id")
        except:
            pass

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS quizzes (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                questions TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attempts (
                id TEXT PRIMARY KEY,
                quiz_id TEXT NOT NULL,
                user_id TEXT,
                score INTEGER DEFAULT 0,
                finished BOOLEAN DEFAULT 0,
                answers TEXT,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        print("✅ База данных инициализирована")


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
    user_id = str(uuid.uuid4())[:8]

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username = ?", (user.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Пользователь уже существует")

        cursor.execute(
            "INSERT INTO users (id, username, password) VALUES (?, ?, ?)",
            (user_id, user.username, user.password)
        )

    return {"success": True, "user_id": user_id, "username": user.username}


@app.post("/login")
async def login(user: UserLogin):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username FROM users WHERE username = ? AND password = ?",
            (user.username, user.password)
        )
        db_user = cursor.fetchone()

        if not db_user:
            raise HTTPException(status_code=401, detail="Неверное имя или пароль")

        return {"success": True, "user_id": db_user["id"], "username": db_user["username"]}


# ============================================
# API ВИКТОРИН
# ============================================
@app.post("/create_quiz")
async def create_quiz(quiz_data: QuizData, request: Request):
    user_id = request.query_params.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=401, detail="Пользователь не найден")

    quiz_id = str(uuid.uuid4())[:8]
    questions_json = json.dumps([q.model_dump() for q in quiz_data.questions], ensure_ascii=False)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO quizzes (id, user_id, title, questions) VALUES (?, ?, ?, ?)",
            (quiz_id, user_id, quiz_data.title, questions_json)
        )

    return {"quiz_id": quiz_id, "title": quiz_data.title}


@app.get("/quiz/{quiz_id}")
async def get_quiz(quiz_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,))
        quiz = cursor.fetchone()

    if not quiz:
        raise HTTPException(status_code=404, detail="Викторина не найдена")

    questions = json.loads(quiz["questions"])

    return {
        "id": quiz["id"],
        "title": quiz["title"],
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

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title, created_at FROM quizzes WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        quizzes = cursor.fetchall()

    return [{"id": q["id"], "title": q["title"], "created_at": q["created_at"]} for q in quizzes]


@app.delete("/delete_quiz/{quiz_id}")
async def delete_quiz(quiz_id: str, request: Request):
    user_id = request.query_params.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM quizzes WHERE id = ? AND user_id = ?", (quiz_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Нет прав на удаление")

        cursor.execute("DELETE FROM quizzes WHERE id = ?", (quiz_id,))

    return {"success": True, "message": "Викторина удалена"}


@app.delete("/delete_all_quizzes")
async def delete_all_quizzes(request: Request):
    user_id = request.query_params.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM quizzes WHERE user_id = ?", (user_id,))

    return {"success": True, "message": "Все викторины удалены"}


@app.delete("/delete_all_attempts")
async def delete_all_attempts(request: Request):
    user_id = request.query_params.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM attempts WHERE user_id = ?", (user_id,))

    return {"success": True, "message": "Все попытки удалены"}


@app.delete("/delete_account")
async def delete_account(request: Request):
    user_id = request.query_params.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))

    return {"success": True, "message": "Аккаунт и все данные удалены"}


@app.delete("/reset_everything")
async def reset_everything():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM attempts")
        cursor.execute("DELETE FROM quizzes")
        cursor.execute("DELETE FROM users")

    return {"success": True, "message": "Все данные полностью удалены"}


@app.get("/admin/stats")
async def get_stats():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM users")
        users_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM quizzes")
        quizzes_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM attempts")
        attempts_count = cursor.fetchone()["count"]

        cursor.execute("SELECT AVG(score) as avg FROM attempts WHERE finished = 1")
        avg_score = cursor.fetchone()["avg"] or 0

    return {
        "total_users": users_count,
        "total_quizzes": quizzes_count,
        "total_attempts": attempts_count,
        "average_score": round(avg_score, 2)
    }


@app.get("/admin/all_users")
async def get_all_users():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, created_at FROM users ORDER BY created_at DESC")
        users = cursor.fetchall()

    return [{"id": u["id"], "username": u["username"], "created_at": u["created_at"]} for u in users]


# ============================================
# ЗАЩИЩЕННАЯ DEV ПАНЕЛЬ
# ============================================

@app.post("/admin/verify")
async def admin_verify(data: dict):
    password = data.get("password")
    if password == ADMIN_PASSWORD:
        return {"success": True, "message": "Доступ разрешен"}
    raise HTTPException(status_code=401, detail="Неверный пароль")


@app.delete("/dev/delete_user/{user_id}")
async def dev_delete_user(user_id: str, password: str = None):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Неверный пароль")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))

    return {"success": True, "message": f"Пользователь {user_id} удален"}


@app.get("/dev/all_users")
async def dev_get_all_users(password: str = None):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Неверный пароль")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, created_at FROM users ORDER BY created_at DESC")
        users = cursor.fetchall()

    return [{"id": u["id"], "username": u["username"], "created_at": u["created_at"]} for u in users]


# ============================================
# ПРОХОЖДЕНИЕ ВИКТОРИНЫ
# ============================================
@app.post("/start_quiz/{quiz_id}")
async def start_quiz(quiz_id: str, request: Request):
    user_id = request.query_params.get("user_id")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM quizzes WHERE id = ?", (quiz_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Викторина не найдена")

    attempt_id = str(uuid.uuid4())[:8]

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO attempts (id, quiz_id, user_id, score, finished, answers) VALUES (?, ?, ?, ?, ?, ?)",
            (attempt_id, quiz_id, user_id, 0, 0, json.dumps([]))
        )

    return {"attempt_id": attempt_id}


@app.post("/answer/{attempt_id}")
async def submit_answer(attempt_id: str, data: dict):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM attempts WHERE id = ?", (attempt_id,))
        attempt = cursor.fetchone()

    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    if attempt["finished"] == 1:
        raise HTTPException(status_code=400, detail="Викторина завершена")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM quizzes WHERE id = ?", (attempt["quiz_id"],))
        quiz = cursor.fetchone()

    questions = json.loads(quiz["questions"])
    question_index = data["question_index"]
    user_answer = data["answer"]
    correct_answer = questions[question_index]["correct"]
    is_correct = (user_answer == correct_answer)

    answers = json.loads(attempt["answers"]) if attempt["answers"] else []
    answers.append({
        "question": question_index,
        "user_answer": user_answer,
        "is_correct": is_correct
    })

    new_score = attempt["score"] + (1 if is_correct else 0)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE attempts SET score = ?, answers = ? WHERE id = ?",
            (new_score, json.dumps(answers), attempt_id)
        )

    return {"correct": is_correct, "score": new_score}


@app.post("/finish_quiz/{attempt_id}")
async def finish_quiz(attempt_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM attempts WHERE id = ?", (attempt_id,))
        attempt = cursor.fetchone()

    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM quizzes WHERE id = ?", (attempt["quiz_id"],))
        quiz = cursor.fetchone()

    questions = json.loads(quiz["questions"])
    total_questions = len(questions)
    percentage = int((attempt["score"] / total_questions) * 100) if total_questions > 0 else 0

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE attempts SET finished = 1 WHERE id = ?", (attempt_id,))

    return {
        "score": attempt["score"],
        "total": total_questions,
        "percentage": percentage
    }


if __name__ == "__main__":
    import uvicorn

    print("=" * 50)
    print("🎯 TikTok Викторина Челлендж")
    print("=" * 50)
    print("✅ Админ пароль:", ADMIN_PASSWORD)
    print("✅ Сервер запущен на http://localhost:8000")
    print("=" * 50)
    uvicorn.run(app, host="127.0.0.1", port=8000)