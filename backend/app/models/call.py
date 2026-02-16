import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Float, ForeignKey, Text, func, JSON, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class CallSchedule(Base):
    __tablename__ = "call_schedules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("patients.id"), nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)  # Week 1, 2, 3, 4, etc.
    scheduled_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, completed, missed, cancelled
    retry_count: Mapped[int] = mapped_column(Integer, default=0)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="call_schedules", lazy="selectin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Call(Base):
    __tablename__ = "calls"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("patients.id"), nullable=False)
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("call_schedules.id"), nullable=True)
    twilio_call_sid: Mapped[str | None] = mapped_column(String(255), nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="initiated")  # initiated, ringing, in_progress, completed, failed, no_answer

    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0.0 - 1.0
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_symptoms: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Doctor review fields
    review_status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, approved, escalated, dismissed
    doctor_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="calls", lazy="selectin")
    messages: Mapped[list["CallMessage"]] = relationship("CallMessage", back_populates="call", lazy="selectin", order_by="CallMessage.timestamp")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CallMessage(Base):
    __tablename__ = "call_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    call_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("calls.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # ai, patient
    content_darija: Mapped[str] = mapped_column(Text, nullable=False)
    content_english: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_symptoms: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    call: Mapped["Call"] = relationship("Call", back_populates="messages", lazy="selectin")
