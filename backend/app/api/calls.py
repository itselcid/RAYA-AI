import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.call import Call, CallSchedule
from app.schemas.call import CallResponse, CallScheduleResponse, CallScheduleCreate, CallCreate

router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("", response_model=list[CallResponse])
async def list_calls(
    patient_id: uuid.UUID | None = None,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Call)
        .join(Patient)
        .where(Patient.assigned_doctor_id == current_user.id)
        .options(selectinload(Call.messages))
    )
    if patient_id:
        query = query.where(Call.patient_id == patient_id)
    if status:
        query = query.where(Call.status == status)
    query = query.order_by(Call.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return [CallResponse.model_validate(c) for c in result.scalars().all()]


@router.get("/{call_id}", response_model=CallResponse)
async def get_call(
    call_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Call)
        .join(Patient)
        .where(Call.id == call_id, Patient.assigned_doctor_id == current_user.id)
        .options(selectinload(Call.messages))
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return CallResponse.model_validate(call)


@router.post("/initiate", response_model=CallResponse, status_code=201)
async def initiate_call(
    data: CallCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initiate an AI call to a patient right now."""
    # Verify patient
    result = await db.execute(
        select(Patient).where(
            Patient.id == data.patient_id,
            Patient.assigned_doctor_id == current_user.id,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Create call record
    call = Call(
        patient_id=patient.id,
        schedule_id=data.schedule_id,
        status="initiated",
        started_at=datetime.now(timezone.utc),
    )
    db.add(call)
    await db.flush()
    await db.refresh(call)

    # Initiate Twilio call
    try:
        from app.services.twilio_service import initiate_call as twilio_call
        call_sid = await twilio_call(patient.phone, str(call.id))
        call.twilio_call_sid = call_sid
        call.status = "ringing"
    except Exception as e:
        call.status = "failed"
        call.summary = f"Failed to initiate: {str(e)}"

    await db.flush()
    await db.refresh(call)
    return CallResponse.model_validate(call)


@router.post("/{call_id}/end")
async def end_call(
    call_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End an active call."""
    result = await db.execute(
        select(Call).join(Patient).where(
            Call.id == call_id,
            Patient.assigned_doctor_id == current_user.id,
        )
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    if call.twilio_call_sid:
        try:
            from app.services.twilio_service import end_call as twilio_end
            await twilio_end(call.twilio_call_sid)
        except Exception:
            pass

    call.status = "completed"
    call.ended_at = datetime.now(timezone.utc)
    if call.started_at:
        call.duration_seconds = int((call.ended_at - call.started_at).total_seconds())

    await db.flush()
    return {"status": "ended"}


@router.get("/schedules/upcoming", response_model=list[CallScheduleResponse])
async def list_upcoming_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CallSchedule)
        .join(Patient)
        .where(
            Patient.assigned_doctor_id == current_user.id,
            CallSchedule.status == "pending",
        )
        .order_by(CallSchedule.scheduled_time.asc())
        .limit(20)
    )
    return [CallScheduleResponse.model_validate(s) for s in result.scalars().all()]


@router.post("/schedules", response_model=CallScheduleResponse, status_code=201)
async def create_schedule(
    data: CallScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = await db.execute(
        select(Patient).where(Patient.id == data.patient_id, Patient.assigned_doctor_id == current_user.id)
    )
    if not patient.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    schedule = CallSchedule(**data.model_dump())
    db.add(schedule)
    await db.flush()
    await db.refresh(schedule)
    return CallScheduleResponse.model_validate(schedule)
