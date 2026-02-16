"""Twilio webhook endpoints for handling call status updates."""
from fastapi import APIRouter, Request, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.call import Call
from app.config import get_settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
settings = get_settings()


@router.post("/twilio/voice")
async def twilio_voice_webhook(request: Request):
    """Initial TwiML response when call connects."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    host = request.headers.get("host", "localhost")

    # Return TwiML that connects to our WebSocket for media streaming
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://{host}/ws/media/{call_sid}" />
    </Connect>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@router.post("/twilio/status")
async def twilio_status_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle call status updates from Twilio."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    call_status = form.get("CallStatus", "")
    duration = form.get("CallDuration", "0")

    result = await db.execute(
        select(Call).where(Call.twilio_call_sid == call_sid)
    )
    call = result.scalar_one_or_none()
    if call:
        status_map = {
            "completed": "completed",
            "busy": "failed",
            "no-answer": "no_answer",
            "failed": "failed",
            "canceled": "failed",
        }
        call.status = status_map.get(call_status, call.status)
        if call_status == "completed":
            call.duration_seconds = int(duration)

            # Trigger risk analysis after call completes
            from app.services.risk_analyzer import analyze_call
            await analyze_call(call.id, db)

    return {"status": "ok"}
