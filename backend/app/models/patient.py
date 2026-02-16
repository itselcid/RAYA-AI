import uuid
from datetime import datetime, date, time
from sqlalchemy import String, DateTime, Date, Time, Integer, ForeignKey, Text, Boolean, func
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)  # male, female
    condition: Mapped[str] = mapped_column(String(255), nullable=False)
    enrollment_date: Mapped[date] = mapped_column(Date, nullable=False)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    language: Mapped[str] = mapped_column(String(50), default="darija")
    status: Mapped[str] = mapped_column(String(50), default="active")  # active, recovered, at_risk, discharged
    call_frequency: Mapped[str] = mapped_column(String(50), default="weekly")  # daily, every_3_days, weekly, biweekly, monthly
    call_time: Mapped[str] = mapped_column(String(10), default="09:00")  # Preferred call time HH:MM (24h)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    assigned_doctor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    doctor: Mapped["User"] = relationship("User", back_populates="patients", lazy="selectin")

    calls: Mapped[list["Call"]] = relationship("Call", back_populates="patient", lazy="selectin")
    call_schedules: Mapped[list["CallSchedule"]] = relationship("CallSchedule", back_populates="patient", lazy="selectin")
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="patient", lazy="selectin")
    questions: Mapped[list["PatientQuestion"]] = relationship("PatientQuestion", back_populates="patient", lazy="selectin", order_by="PatientQuestion.order", cascade="all, delete-orphan")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PatientQuestion(Base):
    """Doctor-configured questions for each patient's check-in calls."""
    __tablename__ = "patient_questions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("patients.id"), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)  # In Darija or any language
    question_english: Mapped[str | None] = mapped_column(Text, nullable=True)  # English translation
    category: Mapped[str] = mapped_column(String(50), default="general")  # medication, vitals, symptoms, diet, mental, general
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="questions", lazy="selectin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
