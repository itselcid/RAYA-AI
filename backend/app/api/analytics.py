from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.call import Call
from app.models.alert import Alert

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Total patients
    patients_result = await db.execute(
        select(func.count(Patient.id)).where(Patient.assigned_doctor_id == current_user.id)
    )
    total_patients = patients_result.scalar()

    # Active patients
    active_result = await db.execute(
        select(func.count(Patient.id)).where(
            Patient.assigned_doctor_id == current_user.id,
            Patient.status == "active",
        )
    )
    active_patients = active_result.scalar()

    # Total calls
    calls_result = await db.execute(
        select(func.count(Call.id))
        .join(Patient)
        .where(Patient.assigned_doctor_id == current_user.id)
    )
    total_calls = calls_result.scalar()

    # Completed calls
    completed_result = await db.execute(
        select(func.count(Call.id))
        .join(Patient)
        .where(
            Patient.assigned_doctor_id == current_user.id,
            Call.status == "completed",
        )
    )
    completed_calls = completed_result.scalar()

    # Average risk score
    risk_result = await db.execute(
        select(func.avg(Call.risk_score))
        .join(Patient)
        .where(
            Patient.assigned_doctor_id == current_user.id,
            Call.risk_score.isnot(None),
        )
    )
    avg_risk = risk_result.scalar()

    # Unresolved alerts
    alerts_result = await db.execute(
        select(func.count(Alert.id))
        .join(Patient)
        .where(
            Patient.assigned_doctor_id == current_user.id,
            Alert.is_resolved == False,
        )
    )
    unresolved_alerts = alerts_result.scalar()

    # At-risk patients
    at_risk_result = await db.execute(
        select(func.count(Patient.id)).where(
            Patient.assigned_doctor_id == current_user.id,
            Patient.status == "at_risk",
        )
    )
    at_risk_patients = at_risk_result.scalar()

    # Recovery rate
    recovered_result = await db.execute(
        select(func.count(Patient.id)).where(
            Patient.assigned_doctor_id == current_user.id,
            Patient.status == "recovered",
        )
    )
    recovered = recovered_result.scalar()
    recovery_rate = (recovered / total_patients * 100) if total_patients > 0 else 0

    return {
        "total_patients": total_patients,
        "active_patients": active_patients,
        "at_risk_patients": at_risk_patients,
        "total_calls": total_calls,
        "completed_calls": completed_calls,
        "avg_risk_score": round(avg_risk, 2) if avg_risk else 0,
        "unresolved_alerts": unresolved_alerts,
        "recovery_rate": round(recovery_rate, 1),
    }
