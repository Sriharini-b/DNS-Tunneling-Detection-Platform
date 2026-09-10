"""SQLAlchemy ORM models."""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    DateTime,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # 'user' | 'assistant'
    content = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)  # structured card data
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_type = Column(String, nullable=False)  # 'single' | 'batch_csv' | 'pcap'
    input_ref = Column(String, nullable=True)  # query name or filename
    risk_score = Column(Float, nullable=True)
    is_tunneling = Column(Boolean, nullable=True)
    high_volume_flag = Column(Boolean, default=False)
    low_and_slow_flag = Column(Boolean, default=False)
    evidence_text = Column(Text, nullable=True)
    raw_features_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True)  # always 1 (single-user)
    theme_mode = Column(String, default="dark")
    primary_color = Column(String, default="#10b981")
    accent_color = Column(String, default="#3b82f6")
    background_color = Column(String, default="#0a0a0a")
    font_size = Column(String, default="md")
    openrouter_api_key_encrypted = Column(Text, nullable=True)
    openrouter_model = Column(String, default="openai/gpt-4o-mini")
    search_provider = Column(String, default="duckduckgo")
    burst_threshold = Column(Float, default=50.0)
    entropy_threshold = Column(Float, default=3.5)
    beaconing_threshold = Column(Float, default=0.1)
