"""
DNS Tunneling Detection Platform — FastAPI Application Entry Point
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import engine, Base
from app.db.init_db import init_db
from app.api import analyze, chat, settings, lookup, dashboard

logger = logging.getLogger(__name__)


def _get_allowed_origins() -> list[str]:
    """
    Read comma-separated allowed origins from ALLOWED_ORIGINS env var.
    Falls back to localhost dev servers if unset.
    Example:  ALLOWED_ORIGINS=https://myapp.vercel.app,http://localhost:5173
    """
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    if raw.strip() == "*":
        return ["*"]
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if not origins:
        # Local development defaults
        origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
        ]
    return origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed default settings
    Base.metadata.create_all(bind=engine)
    init_db()

    # Train ML model in background thread (non-blocking) so server starts immediately
    async def _train_bg():
        try:
            loop = asyncio.get_event_loop()
            from app.ml.classifier import ensure_model_ready
            await loop.run_in_executor(None, ensure_model_ready)
            logger.info("ML model ready.")
        except Exception as e:
            logger.error(f"ML model training failed: {e}")

    asyncio.create_task(_train_bg())

    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="DNS Tunneling Detection Platform",
    description="AI-powered DNS traffic analysis and threat intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — origins are configured via ALLOWED_ORIGINS environment variable
allowed_origins = _get_allowed_origins()
logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(analyze.router, prefix="/api/analyze", tags=["Analyze"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(lookup.router, prefix="/api/lookup", tags=["Lookup"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])


@app.get("/api/health")
async def health():
    from app.ml.classifier import MODEL_PATH
    return {
        "status": "ok",
        "ml_model_ready": MODEL_PATH.exists(),
    }
