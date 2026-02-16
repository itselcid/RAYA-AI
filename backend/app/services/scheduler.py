"""Call scheduling service using APScheduler."""
import uuid
from datetime import datetime, timedelta, timezone, time
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.call import CallSchedule, Call
from app.models.patient import Patient
from app.services import twilio_service


# Chronic disease monitoring schedule: weeks after enrollment
CALL_SCHEDULE_WEEKS = [1, 2, 3, 4, 6, 8, 12]
DEFAULT_CALL_TIME = time(10, 0)  # 10:00 AM


async def create_patient_call_schedules(patient_id: uuid.UUID, db: AsyncSession):
    """Create all follow-up call schedules for a new patient."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        return

    for week in CALL_SCHEDULE_WEEKS:
        scheduled_date = patient.enrollment_date + timedelta(weeks=week)
        scheduled_datetime = datetime.combine(
            scheduled_date, DEFAULT_CALL_TIME, tzinfo=timezone.utc
        )

        # Skip if the date is in the past
        if scheduled_datetime < datetime.now(timezone.utc):
            continue

        schedule = CallSchedule(
            patient_id=patient.id,
            week_number=week,
            scheduled_time=scheduled_datetime,
            status="pending",
        )
        db.add(schedule)

    await db.flush()


async def execute_scheduled_call(schedule_id: uuid.UUID, db: AsyncSession):
    """Execute a scheduled call."""
    result = await db.execute(
        select(CallSchedule).where(CallSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule or schedule.status != "pending":
        return

    # Fetch patient
    patient_result = await db.execute(
        select(Patient).where(Patient.id == schedule.patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        return

    # Create call record
    call = Call(
        patient_id=patient.id,
        schedule_id=schedule.id,
        status="initiated",
        started_at=datetime.now(timezone.utc),
    )
    db.add(call)
    await db.flush()
    await db.refresh(call)

    try:
        # Initiate Twilio call
        call_sid = await twilio_service.initiate_call(
            patient_phone=patient.phone,
            call_id=str(call.id),
        )
        call.twilio_call_sid = call_sid
        call.status = "ringing"
        schedule.status = "completed"
    except Exception as e:
        call.status = "failed"
        schedule.retry_count += 1
        if schedule.retry_count >= 3:
            schedule.status = "missed"
        print(f"Failed to initiate call: {e}")

    await db.flush()
    return call
