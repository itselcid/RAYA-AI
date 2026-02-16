"""Post-call risk analysis service for patient follow-up monitoring."""
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.call import Call
from app.models.patient import Patient
from app.models.alert import Alert
from app.services import minimax_service


async def analyze_call(call_id: uuid.UUID, db: AsyncSession):
    """Analyze a completed call for health deterioration risk and create alerts if needed."""
    # Fetch call with messages
    result = await db.execute(
        select(Call).where(Call.id == call_id)
    )
    call = result.scalar_one_or_none()
    if not call:
        return

    # Fetch patient
    patient_result = await db.execute(
        select(Patient).where(Patient.id == call.patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        return

    # Build transcript
    transcript_parts = []
    for msg in call.messages:
        role = "Raya AI" if msg.role == "ai" else "Patient"
        transcript_parts.append(f"{role}: {msg.content_darija}")
        if msg.content_english:
            transcript_parts.append(f"  [EN: {msg.content_english}]")

    transcript = "\n".join(transcript_parts)
    if not transcript:
        return

    # Calculate weeks since enrollment
    weeks_enrolled = (date.today() - patient.enrollment_date).days // 7

    # Run AI analysis
    analysis = await minimax_service.analyze_risk(
        transcript=transcript,
        patient_info={
            "name": patient.name,
            "condition": patient.condition,
            "weeks_enrolled": weeks_enrolled,
        },
    )

    # Update call with analysis
    call.risk_score = analysis.get("risk_score", 0)
    call.summary = analysis.get("summary", "")
    call.detected_symptoms = {
        "symptoms": analysis.get("detected_symptoms", []),
        "risk_level": analysis.get("risk_level", "low"),
        "recommendations": analysis.get("recommendations", []),
    }

    # Create alerts for high/critical risk
    risk_level = analysis.get("risk_level", "low")
    if risk_level in ("high", "critical"):
        alert = Alert(
            call_id=call.id,
            patient_id=patient.id,
            severity=risk_level,
            alert_type="health_deterioration",
            title=f"Health deterioration risk detected - {patient.name}",
            description=analysis.get("summary", "Risk detected during check-in call"),
        )
        db.add(alert)

        # Update patient status
        patient.status = "at_risk"

    if analysis.get("needs_immediate_attention"):
        alert = Alert(
            call_id=call.id,
            patient_id=patient.id,
            severity="critical",
            alert_type="immediate_attention",
            title=f"URGENT: {patient.name} needs immediate attention",
            description=analysis.get("summary", ""),
        )
        db.add(alert)

    await db.flush()
    return analysis
