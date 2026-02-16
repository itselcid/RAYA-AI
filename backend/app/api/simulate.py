"""Call simulation API — doctor-configured AI phone assistant."""
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.patient import Patient, PatientQuestion
from app.models.call import Call, CallMessage
from app.models.alert import Alert
from app.config import get_settings
from app.prompts.medical_darija import SYSTEM_PROMPT, RISK_ANALYSIS_PROMPT

router = APIRouter(prefix="/simulate", tags=["simulate"])
settings = get_settings()

# In-memory conversation state per call
# Stores: {"history": [...], "questions": [...], "patient_name": str, "condition": str}
_sessions: dict[str, dict] = {}


# --- Request / Response Models ---

class SimulateStartRequest(BaseModel):
    patient_id: uuid.UUID


class SimulateMessageRequest(BaseModel):
    text: str


class SimulateMessageResponse(BaseModel):
    patient_darija: str
    patient_english: str | None
    ai_darija: str
    ai_english: str | None
    audio_base64: str | None
    message_index: int


class SimulateStartResponse(BaseModel):
    call_id: str
    patient_name: str
    greeting_darija: str
    greeting_english: str
    audio_base64: str | None
    questions: list[dict]  # Doctor's configured questions


class ReviewRequest(BaseModel):
    action: str  # approve, escalate, dismiss
    doctor_notes: str | None = None


# --- Helpers ---

def _build_system_prompt(patient_name: str, questions: list[dict]) -> str:
    """Build the system prompt with doctor's configured questions."""
    questions_text = ""
    for i, q in enumerate(questions, 1):
        eng = f" ({q['english']})" if q.get("english") else ""
        questions_text += f"{i}. {q['text']}{eng}\n"

    if not questions_text:
        questions_text = "1. كيف كتحس اليوم بشكل عام؟ (How do you feel today overall?)\n"

    prompt = SYSTEM_PROMPT.replace("{doctor_questions}", questions_text)
    prompt = prompt.replace("[name]", patient_name)
    return prompt


# --- Endpoints ---

@router.post("/start", response_model=SimulateStartResponse)
async def start_simulation(
    data: SimulateStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a simulated call — returns the AI greeting + doctor's questions."""
    result = await db.execute(
        select(Patient).where(
            Patient.id == data.patient_id,
            Patient.assigned_doctor_id == current_user.id,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Fetch doctor's configured questions for this patient
    q_result = await db.execute(
        select(PatientQuestion)
        .where(PatientQuestion.patient_id == patient.id, PatientQuestion.is_active == True)
        .order_by(PatientQuestion.order)
    )
    questions = [
        {
            "id": str(q.id),
            "text": q.question_text,
            "english": q.question_english,
            "category": q.category,
            "order": q.order,
        }
        for q in q_result.scalars().all()
    ]

    # Create call record
    call = Call(
        patient_id=patient.id,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
        review_status="pending",
    )
    db.add(call)
    await db.flush()
    await db.refresh(call)
    call_id = str(call.id)

    # Generate greeting using LLM or fallback
    has_api = bool(settings.GROQ_API_KEY or settings.MINIMAX_API_KEY)
    system = _build_system_prompt(patient.name, questions)

    if has_api:
        from app.services import minimax_service
        greeting = await minimax_service.chat_completion(
            messages=[{"role": "user", "content": f"(The call just started. Greet the patient {patient.name} warmly in Darija. You are calling on behalf of their doctor for a check-in about their {patient.condition}. Then ask the first question from the doctor's list.)"}],
            system_prompt=system,
        )
        english = await minimax_service.translate_darija_to_english(greeting)
    else:
        greeting = f"السلام عليكم، كيف داير/ة اليوم؟ أنا رعاية، كنتصل بيك من طرف الدكتور ديالك."
        english = "Hello, how are you today? I'm Raya, calling on behalf of your doctor."

    # Save greeting as AI message
    msg = CallMessage(
        call_id=call.id, role="ai",
        content_darija=greeting, content_english=english,
    )
    db.add(msg)
    await db.flush()

    # Init session with questions
    _sessions[call_id] = {
        "history": [{"role": "assistant", "content": greeting}],
        "questions": questions,
        "patient_name": patient.name,
        "condition": patient.condition,
        "system_prompt": system,
    }

    # TTS — Edge TTS Moroccan Arabic (primary) → ElevenLabs (fallback)
    audio_b64 = None
    import base64
    # 1. Edge TTS — Moroccan Arabic voice (ar-MA-MounaNeural)
    try:
        from app.services import edge_tts_service
        audio = await edge_tts_service.text_to_speech(greeting)
        if audio:
            audio_b64 = base64.b64encode(audio).decode("utf-8")
    except Exception as e:
        print(f"Edge TTS failed: {e}")
    # 2. Fallback to ElevenLabs
    if not audio_b64 and settings.ELEVENLABS_API_KEY:
        try:
            from app.services import elevenlabs_service
            audio = await elevenlabs_service.text_to_speech(greeting)
            audio_b64 = base64.b64encode(audio).decode("utf-8")
        except Exception:
            pass

    return SimulateStartResponse(
        call_id=call_id,
        patient_name=patient.name,
        greeting_darija=greeting,
        greeting_english=english,
        audio_base64=audio_b64,
        questions=questions,
    )


@router.post("/{call_id}/message", response_model=SimulateMessageResponse)
async def send_message(
    call_id: str,
    data: SimulateMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a patient message and get AI response."""
    result = await db.execute(select(Call).where(Call.id == uuid.UUID(call_id)))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    session = _sessions.get(call_id, {})
    history = session.get("history", [])
    system = session.get("system_prompt", "")
    has_api = bool(settings.GROQ_API_KEY or settings.MINIMAX_API_KEY)
    msg_index = len(history) // 2

    if has_api:
        from app.services import minimax_service

        patient_english = await minimax_service.translate_darija_to_english(data.text)
        history.append({"role": "user", "content": data.text})

        ai_darija = await minimax_service.chat_completion(
            messages=history,
            system_prompt=system,
        )
        ai_english = await minimax_service.translate_darija_to_english(ai_darija)
        history.append({"role": "assistant", "content": ai_darija})
    else:
        patient_english = f"[Translation: {data.text}]"
        ai_darija = "شكرا على الجواب ديالك. غادي نبلغ الدكتور."
        ai_english = "Thank you for your answer. I'll inform the doctor."
        history.append({"role": "user", "content": data.text})
        history.append({"role": "assistant", "content": ai_darija})

    session["history"] = history
    _sessions[call_id] = session

    # Strip [CALL_COMPLETE] tag from stored text (keep raw for frontend detection)
    ai_darija_raw = ai_darija
    ai_english_raw = ai_english
    ai_darija_clean = ai_darija.replace("[CALL_COMPLETE]", "").strip()
    ai_english_clean = (ai_english or "").replace("[CALL_COMPLETE]", "").strip()

    # Save to DB (clean version without tag)
    patient_msg = CallMessage(
        call_id=call.id, role="patient",
        content_darija=data.text, content_english=patient_english,
    )
    ai_msg = CallMessage(
        call_id=call.id, role="ai",
        content_darija=ai_darija_clean, content_english=ai_english_clean,
    )
    db.add(patient_msg)
    db.add(ai_msg)
    await db.flush()

    # TTS (use clean version) — Edge TTS Moroccan Arabic → ElevenLabs
    audio_b64 = None
    import base64
    # 1. Edge TTS — Moroccan Arabic voice (ar-MA-MounaNeural)
    try:
        from app.services import edge_tts_service
        audio = await edge_tts_service.text_to_speech(ai_darija_clean)
        if audio:
            audio_b64 = base64.b64encode(audio).decode("utf-8")
    except Exception as e:
        print(f"Edge TTS failed: {e}")
    # 2. Fallback to ElevenLabs
    if not audio_b64 and settings.ELEVENLABS_API_KEY:
        try:
            from app.services import elevenlabs_service
            audio = await elevenlabs_service.text_to_speech(ai_darija_clean)
            audio_b64 = base64.b64encode(audio).decode("utf-8")
        except Exception:
            pass

    return SimulateMessageResponse(
        patient_darija=data.text,
        patient_english=patient_english,
        ai_darija=ai_darija_raw,
        ai_english=ai_english_raw,
        audio_base64=audio_b64,
        message_index=msg_index,
    )


@router.post("/{call_id}/end")
async def end_simulation(
    call_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End simulated call — AI evaluates (suggestion only), doctor reviews later."""
    result = await db.execute(select(Call).where(Call.id == uuid.UUID(call_id)))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    call.status = "completed"
    call.ended_at = datetime.now(timezone.utc)
    if call.started_at:
        started = call.started_at
        ended = call.ended_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        if ended.tzinfo is None:
            ended = ended.replace(tzinfo=timezone.utc)
        call.duration_seconds = int((ended - started).total_seconds())

    # AI evaluation (suggestion only — no auto-alerts)
    analysis = None
    session = _sessions.get(call_id, {})
    history = session.get("history", [])
    questions = session.get("questions", [])

    if (settings.GROQ_API_KEY or settings.MINIMAX_API_KEY) and len(history) > 0:
        try:
            transcript_parts = []
            for msg in history:
                role = "Raya AI" if msg.get("role") == "assistant" else "Patient"
                transcript_parts.append(f"{role}: {msg.get('content', '')}")
            transcript = "\n".join(transcript_parts)

            patient_result = await db.execute(
                select(Patient).where(Patient.id == call.patient_id)
            )
            patient = patient_result.scalar_one_or_none()

            if patient and transcript.strip():
                from datetime import date as date_cls
                from app.services import minimax_service
                weeks_enrolled = (date_cls.today() - patient.enrollment_date).days // 7

                # Build questions text for the analysis prompt
                q_text = "\n".join(
                    f"{i+1}. {q.get('text', '')} ({q.get('english', '')})"
                    for i, q in enumerate(questions)
                ) or "No specific questions configured"

                analysis = await minimax_service.analyze_risk(
                    transcript=transcript,
                    patient_info={
                        "name": patient.name,
                        "condition": patient.condition,
                        "weeks_enrolled": weeks_enrolled,
                        "doctor_questions": q_text,
                    },
                )

                # Update call with AI suggestion (pending doctor review)
                call.risk_score = analysis.get("risk_score", 0)
                call.summary = analysis.get("summary", "")
                call.detected_symptoms = {
                    "symptoms": analysis.get("detected_symptoms", []),
                    "risk_level": analysis.get("risk_level", "low"),
                    "recommendations": analysis.get("recommendations", []),
                    "question_answers": analysis.get("question_answers", []),
                }
                call.review_status = "pending"  # Doctor must review

                # NO auto-alert creation — doctor decides
                analysis["status"] = "pending_review"
                print(f"AI evaluation complete: {analysis.get('risk_level')} ({analysis.get('risk_score')}) — pending doctor review")
        except Exception as e:
            import traceback
            print(f"Risk analysis error: {e}")
            traceback.print_exc()

    _sessions.pop(call_id, None)
    await db.flush()

    return {
        "status": "completed",
        "duration_seconds": call.duration_seconds,
        "analysis": analysis,
        "review_status": "pending",
    }


@router.post("/{call_id}/review")
async def review_call(
    call_id: str,
    data: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Doctor reviews the AI evaluation and decides: approve, escalate, or dismiss."""
    result = await db.execute(select(Call).where(Call.id == uuid.UUID(call_id)))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    if data.action not in ("approve", "escalate", "dismiss"):
        raise HTTPException(status_code=400, detail="Action must be: approve, escalate, or dismiss")

    call.review_status = data.action
    call.doctor_notes = data.doctor_notes

    if data.action == "escalate":
        # Doctor confirmed — NOW create the alert
        patient_result = await db.execute(
            select(Patient).where(Patient.id == call.patient_id)
        )
        patient = patient_result.scalar_one_or_none()

        risk_level = "high"
        if call.detected_symptoms:
            risk_level = call.detected_symptoms.get("risk_level", "high")

        alert = Alert(
            call_id=call.id,
            patient_id=call.patient_id,
            severity=risk_level,
            alert_type="doctor_escalated",
            title=f"Doctor escalated: {patient.name if patient else 'Patient'} — {call.summary or 'Review required'}",
            description=f"Doctor review: {data.doctor_notes or call.summary or 'Escalated by doctor after AI check-in'}",
        )
        db.add(alert)

        if patient:
            patient.status = "at_risk"

    await db.flush()

    return {
        "status": data.action,
        "call_id": call_id,
        "message": {
            "approve": "Call reviewed — no action needed.",
            "escalate": "Alert created — patient flagged as at-risk.",
            "dismiss": "Call dismissed — no further action.",
        }.get(data.action, ""),
    }
