import uuid
from datetime import datetime
from pydantic import BaseModel


class CallCreate(BaseModel):
    patient_id: uuid.UUID
    schedule_id: uuid.UUID | None = None


class CallMessageResponse(BaseModel):
    id: uuid.UUID
    call_id: uuid.UUID
    role: str
    content_darija: str
    content_english: str | None = None
    detected_symptoms: dict | None = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class CallResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    schedule_id: uuid.UUID | None = None
    twilio_call_sid: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int | None = None
    status: str
    risk_score: float | None = None
    summary: str | None = None
    detected_symptoms: dict | None = None
    messages: list[CallMessageResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class CallScheduleCreate(BaseModel):
    patient_id: uuid.UUID
    week_number: int
    scheduled_time: datetime


class CallScheduleResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    week_number: int
    scheduled_time: datetime
    status: str
    retry_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
