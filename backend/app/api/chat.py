"""
Chat API — session management + streaming message endpoint with SSE.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, AsyncIterator, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import ChatMessage, ChatSession, UserSettings
from app.schemas.schemas import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionResponse,
)
from app.services import dns_lookup, openrouter
from app.services.encryption import decrypt

router = APIRouter()


def _get_api_key_and_model(db: Session):
    settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not settings or not settings.openrouter_api_key_encrypted:
        return None, "openai/gpt-4o-mini"
    try:
        key = decrypt(settings.openrouter_api_key_encrypted)
    except Exception:
        return None, settings.openrouter_model or "openai/gpt-4o-mini"
    return key, settings.openrouter_model or "openai/gpt-4o-mini"


# ── Session CRUD ──────────────────────────────────────────────────────────────

@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(req: ChatSessionCreate, db: Session = Depends(get_db)):
    session = ChatSession(
        id=str(uuid.uuid4()),
        title=req.title or "New conversation",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_sessions(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(ChatSession).order_by(ChatSession.updated_at.desc())
    if search:
        query = query.filter(ChatSession.title.ilike(f"%{search}%"))
    return query.all()


@router.get("/sessions/{session_id}", response_model=List[ChatMessageResponse])
async def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"ok": True}


@router.delete("/messages/{message_id}")
async def delete_message(message_id: int, db: Session = Depends(get_db)):
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"ok": True}


@router.patch("/sessions/{session_id}/title")
async def rename_session(session_id: str, body: dict, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = body.get("title", session.title)
    session.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ── Message / Chat ─────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: str,
    req: ChatMessageCreate,
    db: Session = Depends(get_db),
):
    """Send a message and stream back the assistant response via SSE."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    api_key, model = _get_api_key_and_model(db)
    if not api_key:
        raise HTTPException(
            status_code=402,
            detail="No OpenRouter API key configured. Please add one in Settings → AI Configuration.",
        )

    # Save user message
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=req.content,
        created_at=datetime.utcnow(),
    )
    db.add(user_msg)

    # Auto-title session from first message if title is default
    if (not session.title or session.title in ("New conversation", "Untitled")) and req.content:
        session.title = req.content.strip()[:60]
    session.updated_at = datetime.utcnow()
    db.commit()

    # Detect domain in user message
    domain = openrouter.detect_domain_in_message(req.content)
    domain_context: Optional[Dict[str, Any]] = None
    if domain:
        try:
            domain_context = await dns_lookup.full_domain_lookup(domain)
        except Exception:
            domain_context = None

    # Build message history (last 20 for context window)
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(20)
        .all()
    )
    messages = [{"role": m.role, "content": m.content} for m in history]

    # Collect full response to persist it
    full_response_parts: List[str] = []
    metadata: Optional[str] = None

    async def event_generator() -> AsyncIterator[str]:
        nonlocal full_response_parts, metadata

        try:
            async for chunk in openrouter.stream_chat_completion(
                api_key=api_key,
                model=model,
                messages=messages,
                domain_context=domain_context,
            ):
                full_response_parts.append(chunk)
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"

        except Exception as e:
            error_msg = f"AI service error: {str(e)}"
            full_response_parts.append(error_msg)
            yield f"data: {json.dumps({'chunk': error_msg})}\n\n"

        full_text = "".join(full_response_parts)

        # Try to parse structured JSON response for card metadata
        try:
            if full_text.strip().startswith("{"):
                parsed = json.loads(full_text)
                metadata = json.dumps(parsed)
        except Exception:
            pass

        # Persist assistant message
        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=full_text,
            metadata_json=metadata,
            created_at=datetime.utcnow(),
        )
        db_local = next(get_db())
        db_local.add(assistant_msg)
        db_local.commit()
        db_local.close()

        yield f"data: {json.dumps({'done': True, 'metadata': metadata})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
