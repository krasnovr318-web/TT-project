# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

quizzes = {}
attempts = {}

@app.get("/", response_class=HTMLResponse)
async def home():
    return """
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>TikTok Quiz</title></head>
    <body style="font-family:Arial;text-align:center;padding:50px;background:linear-gradient(135deg,#667eea,#764ba2);color:white">
        <h1>🎯 TikTok Викторина</h1>
        <p>Сервер работает!</p>
        <p>Создайте викторину через API</p>
    </body>
    </html>
    """

@app.post("/create_quiz")
async def create_quiz(data: dict):
    quiz_id = str(uuid.uuid4())[:8]
    quizzes[quiz_id] = data
    return {"quiz_id": quiz_id}

@app.get("/quiz/{quiz_id}")
async def get_quiz(quiz_id: str):
    if quiz_id not in quizzes:
        return {"error": "not found"}
    return quizzes[quiz_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)