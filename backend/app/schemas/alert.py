import uuid
from datetime import datetime
from pydantic import BaseModel


class AlertCreate(BaseModel):
    patient_id: uuid.UUID
    call_id: uuid.UUID | None = None
    severity: str
    alert_type: str
    title: str
    description: str


class AlertUpdate(BaseModel):
    is_resolved: bool | None = None
    severity: str | None = None


class AlertResponse(BaseModel):
    id: uuid.UUID
    call_id: uuid.UUID | None = None
    patient_id: uuid.UUID
    severity: str
    alert_type: str
    title: str
    description: str
    is_resolved: bool
    resolved_at: datetime | None = None
    resolved_by_id: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
