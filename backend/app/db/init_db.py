"""
Database initialization — seeds default user_settings row on first run.
"""
from app.db.database import SessionLocal
from app.models.models import UserSettings


def init_db() -> None:
    """Create the default settings row if it doesn't exist."""
    db = SessionLocal()
    try:
        existing = db.query(UserSettings).filter(UserSettings.id == 1).first()
        if not existing:
            default = UserSettings(
                id=1,
                theme_mode="dark",
                primary_color="#10b981",
                accent_color="#3b82f6",
                background_color="#0a0a0a",
                font_size="md",
                openrouter_api_key_encrypted=None,
                openrouter_model="openai/gpt-4o-mini",
                search_provider="duckduckgo",
                burst_threshold=50.0,
                entropy_threshold=3.5,
                beaconing_threshold=0.1,
            )
            db.add(default)
            db.commit()
    finally:
        db.close()
