from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime

DATABASE_URL = "sqlite:///./chat_history.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ChatSession(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    messages = relationship("ChatMessage", back_populates="session")

class ChatMessage(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    role = Column(String) # 'user' or 'assistant'
    content = Column(Text)
    session = relationship("ChatSession", back_populates="messages")

Base.metadata.create_all(bind=engine)