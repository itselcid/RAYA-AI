import uuid
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db, engine, Base
from app.api import auth, patients, calls, alerts, analytics, webhooks, simulate
from app.services.voice_pipeline import VoicePipelineSession

settings = get_settings()

# Track active WebSocket connections for live transcript streaming
active_transcript_connections: dict[str, list[WebSocket]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic migrations in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="AI-Powered Patient Follow-up Platform — automated check-in calls for any condition",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth.router, prefix="/api")
app.include_router(patients.router, prefix="/api")
app.include_router(calls.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")
app.include_router(simulate.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "raya-api"}


@app.websocket("/ws/media/{call_sid}")
async def media_stream_websocket(websocket: WebSocket, call_sid: str):
    """Twilio Media Stream WebSocket — handles real-time audio during calls."""
    from app.database import async_session

    async with async_session() as db:
        session = VoicePipelineSession(
            call_id=call_sid,
            patient_name="Patient",  # Will be resolved from call record
            db=db,
        )
        await session.handle_media_stream(websocket)


@app.websocket("/ws/transcript/{call_id}")
async def transcript_websocket(websocket: WebSocket, call_id: str):
    """WebSocket for streaming live transcript to the frontend dashboard."""
    await websocket.accept()

    if call_id not in active_transcript_connections:
        active_transcript_connections[call_id] = []
    active_transcript_connections[call_id].append(websocket)

    try:
        while True:
            # Keep connection alive, receive any control messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        active_transcript_connections[call_id].remove(websocket)
        if not active_transcript_connections[call_id]:
            del active_transcript_connections[call_id]


async def broadcast_transcript_update(call_id: str, message: dict):
    """Broadcast a transcript update to all connected frontend clients."""
    connections = active_transcript_connections.get(call_id, [])
    for ws in connections:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            pass
