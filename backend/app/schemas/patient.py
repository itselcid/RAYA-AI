import uuid
from datetime import datetime, date
from pydantic import BaseModel


class PatientCreate(BaseModel):
    name: str
    phone: str
    age: int
    gender: str
    condition: str
    enrollment_date: date
    city: str | None = None
    language: str = "darija"
    call_frequency: str = "weekly"
    call_time: str = "09:00"
    notes: str | None = None


class PatientUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    age: int | None = None
    gender: str | None = None
    condition: str | None = None
    enrollment_date: date | None = None
    city: str | None = None
    language: str | None = None
    status: str | None = None
    call_frequency: str | None = None
    call_time: str | None = None
    notes: str | None = None


class PatientResponse(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    age: int
    gender: str
    condition: str
    enrollment_date: date
    city: str | None = None
    language: str
    status: str
    call_frequency: str
    call_time: str
    notes: str | None = None
    assigned_doctor_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Patient Questions ---

class QuestionCreate(BaseModel):
    question_text: str
    question_english: str | None = None
    category: str = "general"
    order: int = 0
    is_active: bool = True


class QuestionUpdate(BaseModel):
    question_text: str | None = None
    question_english: str | None = None
    category: str | None = None
    order: int | None = None
    is_active: bool | None = None


class QuestionResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    question_text: str
    question_english: str | None = None
    category: str
    order: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkQuestionsUpdate(BaseModel):
    questions: list[QuestionCreate]


class PatientCreateWithQuestions(BaseModel):
    """Create patient + configure questions in one request."""
    name: str
    phone: str
    age: int
    gender: str
    condition: str
    enrollment_date: date
    city: str | None = None
    language: str = "darija"
    call_frequency: str = "weekly"
    call_time: str = "09:00"
    notes: str | None = None
    questions: list[QuestionCreate] = []
