# database.py
from sqlalchemy import create_engine, Column, String, Integer, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json
import os

# Подключение к базе данных
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://user:password@localhost/quizdb")

# Для Render нужно заменить postgres:// на postgresql://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class QuizDB(Base):
    __tablename__ = "quizzes"

    id = Column(String, primary_key=True, index=True)
    title = Column(String)
    questions = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class AttemptDB(Base):
    __tablename__ = "attempts"

    id = Column(String, primary_key=True, index=True)
    quiz_id = Column(String)
    score = Column(Integer, default=0)
    finished = Column(Integer, default=0)  # 0=False, 1=True
    answers = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


# Создаем таблицы
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()