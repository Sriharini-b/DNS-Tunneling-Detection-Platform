"""Settings API — get and update user preferences."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import UserSettings
from app.schemas.schemas import SettingsResponse, SettingsUpdate
from app.services.encryption import encrypt

router = APIRouter()


@router.get("", response_model=SettingsResponse)
async def get_settings(db: Session = Depends(get_db)):
    s = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not s:
        raise HTTPException(status_code=404, detail="Settings not found")
    return SettingsResponse(
        theme_mode=s.theme_mode,
        primary_color=s.primary_color,
        accent_color=s.accent_color,
        background_color=s.background_color,
        font_size=s.font_size,
        openrouter_model=s.openrouter_model,
        search_provider=s.search_provider,
        burst_threshold=s.burst_threshold,
        entropy_threshold=s.entropy_threshold,
        beaconing_threshold=s.beaconing_threshold,
        has_api_key=bool(s.openrouter_api_key_encrypted),
    )


@router.patch("", response_model=SettingsResponse)
async def update_settings(req: SettingsUpdate, db: Session = Depends(get_db)):
    s = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not s:
        raise HTTPException(status_code=404, detail="Settings not found")

    if req.theme_mode is not None:
        s.theme_mode = req.theme_mode
    if req.primary_color is not None:
        s.primary_color = req.primary_color
    if req.accent_color is not None:
        s.accent_color = req.accent_color
    if req.background_color is not None:
        s.background_color = req.background_color
    if req.font_size is not None:
        s.font_size = req.font_size
    if req.openrouter_model is not None:
        s.openrouter_model = req.openrouter_model
    if req.search_provider is not None:
        s.search_provider = req.search_provider
    if req.burst_threshold is not None:
        s.burst_threshold = req.burst_threshold
    if req.entropy_threshold is not None:
        s.entropy_threshold = req.entropy_threshold
    if req.beaconing_threshold is not None:
        s.beaconing_threshold = req.beaconing_threshold
    if req.openrouter_api_key is not None and req.openrouter_api_key.strip():
        raw_key = req.openrouter_api_key.strip()
        if raw_key.lower().startswith("bearer "):
            raw_key = raw_key[7:].strip()
        if raw_key.startswith("sk-or-v1") and not raw_key.startswith("sk-or-v1-"):
            raw_key = "sk-or-v1-" + raw_key[8:]
        s.openrouter_api_key_encrypted = encrypt(raw_key)

    db.commit()
    db.refresh(s)

    return SettingsResponse(
        theme_mode=s.theme_mode,
        primary_color=s.primary_color,
        accent_color=s.accent_color,
        background_color=s.background_color,
        font_size=s.font_size,
        openrouter_model=s.openrouter_model,
        search_provider=s.search_provider,
        burst_threshold=s.burst_threshold,
        entropy_threshold=s.entropy_threshold,
        beaconing_threshold=s.beaconing_threshold,
        has_api_key=bool(s.openrouter_api_key_encrypted),
    )
