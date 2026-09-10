"""
SQLAlchemy database configuration.

DATABASE_URL priority:
  1. DATABASE_URL environment variable  — set this in production (supports postgres:// too)
  2. /tmp/dns_platform.db              — cloud default (writable on Render/Railway free tier)
  3. Local file next to this module    — original local dev path
"""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Resolve database URL
_env_url = os.environ.get("DATABASE_URL", "").strip()
if _env_url:
    # Render/Heroku ship postgres:// but SQLAlchemy 2.x needs postgresql://
    if _env_url.startswith("postgres://"):
        _env_url = "postgresql" + _env_url[8:]
    DATABASE_URL = _env_url
else:
    # Use /tmp in cloud (writable), or local file for dev
    _local_path = Path(__file__).parent / "dns_platform.db"
    DATABASE_URL = f"sqlite:///{_local_path}"

# SQLite-specific connect arg (ignored for PostgreSQL)
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
