# quiz_backend.py - УПРОЩЕННАЯ ВЕРСИЯ ДЛЯ ТЕСТА
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_class=HTMLResponse)
async def home():
    return """
    <!DOCTYPE html>
    <html>
    <head><title>Test</title></head>
    <body style="font-family:Arial;text-align:center;padding:50px">
        <h1>🎯 Сервер работает!</h1>
        <p>Если вы видите это сообщение, сервер запущен правильно.</p>
        <p>Проблема в подключении к базе данных.</p>
    </body>
    </html>
    """

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)