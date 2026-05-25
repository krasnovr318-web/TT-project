# quiz_backend.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import uuid
import os

from database import get_db, QuizDB, AttemptDB

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Question(BaseModel):
    text: str
    options: List[str]
    correct: int


class QuizData(BaseModel):
    title: str
    questions: List[Question]


# Отдача файлов
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


# API с сохранением в базу данных
@app.post("/create_quiz")
async def create_quiz(quiz_data: QuizData, db: Session = Depends(get_db)):
    quiz_id = str(uuid.uuid4())[:8]

    new_quiz = QuizDB(
        id=quiz_id,
        title=quiz_data.title,
        questions=[q.dict() for q in quiz_data.questions]
    )
    db.add(new_quiz)
    db.commit()

    return {"quiz_id": quiz_id, "title": quiz_data.title}


@app.get("/quiz/{quiz_id}")
async def get_quiz(quiz_id: str, db: Session = Depends(get_db)):
    quiz = db.query(QuizDB).filter(QuizDB.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Викторина не найдена")

    return {
        "id": quiz.id,
        "title": quiz.title,
        "questions": [
            {"text": q["text"], "options": q["options"]}
            for q in quiz.questions
        ]
    }


@app.post("/start_quiz/{quiz_id}")
async def start_quiz(quiz_id: str, db: Session = Depends(get_db)):
    quiz = db.query(QuizDB).filter(QuizDB.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Викторина не найдена")

    attempt_id = str(uuid.uuid4())[:8]
    new_attempt = AttemptDB(
        id=attempt_id,
        quiz_id=quiz_id,
        score=0,
        finished=0,
        answers=[]
    )
    db.add(new_attempt)
    db.commit()

    return {"attempt_id": attempt_id}


@app.post("/answer/{attempt_id}")
async def submit_answer(attempt_id: str, data: dict, db: Session = Depends(get_db)):
    attempt = db.query(AttemptDB).filter(AttemptDB.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    if attempt.finished == 1:
        raise HTTPException(status_code=400, detail="Викторина завершена")

    quiz = db.query(QuizDB).filter(QuizDB.id == attempt.quiz_id).first()
    question = quiz.questions[data["question_index"]]
    is_correct = (data["answer"] == question["correct"])

    # Обновляем ответы
    answers = attempt.answers or []
    answers.append({
        "question_index": data["question_index"],
        "answer": data["answer"],
        "is_correct": is_correct
    })
    attempt.answers = answers

    if is_correct:
        attempt.score += 1

    db.commit()

    return {"correct": is_correct, "score": attempt.score}


@app.post("/finish_quiz/{attempt_id}")
async def finish_quiz(attempt_id: str, db: Session = Depends(get_db)):
    attempt = db.query(AttemptDB).filter(AttemptDB.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    quiz = db.query(QuizDB).filter(QuizDB.id == attempt.quiz_id).first()
    total_questions = len(quiz.questions)
    attempt.finished = 1
    db.commit()

    percentage = int((attempt.score / total_questions) * 100) if total_questions > 0 else 0

    return {
        "score": attempt.score,
        "total": total_questions,
        "percentage": percentage
    }


if __name__ == "__main__":
    import uvicorn

    print("=" * 50)
    print("Сервер запущен на http://localhost:8000")
    print("База данных: PostgreSQL")
    print("=" * 50)
    uvicorn.run(app, host="127.0.0.1", port=8000)