import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.alert import Alert
from app.schemas.alert import AlertResponse, AlertUpdate

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    severity: str | None = None,
    is_resolved: bool | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Alert)
        .join(Patient)
        .where(Patient.assigned_doctor_id == current_user.id)
    )
    if severity:
        query = query.where(Alert.severity == severity)
    if is_resolved is not None:
        query = query.where(Alert.is_resolved == is_resolved)
    query = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return [AlertResponse.model_validate(a) for a in result.scalars().all()]


@router.get("/count")
async def count_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(Alert.id))
        .join(Patient)
        .where(Patient.assigned_doctor_id == current_user.id, Alert.is_resolved == False)
    )
    unresolved = result.scalar()
    # By severity
    severities = {}
    for s in ["critical", "high", "medium", "low"]:
        r = await db.execute(
            select(func.count(Alert.id))
            .join(Patient)
            .where(
                Patient.assigned_doctor_id == current_user.id,
                Alert.is_resolved == False,
                Alert.severity == s,
            )
        )
        severities[s] = r.scalar()
    return {"unresolved": unresolved, "by_severity": severities}


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: uuid.UUID,
    data: AlertUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Alert)
        .join(Patient)
        .where(Alert.id == alert_id, Patient.assigned_doctor_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if data.is_resolved is not None:
        alert.is_resolved = data.is_resolved
        if data.is_resolved:
            alert.resolved_at = datetime.now(timezone.utc)
            alert.resolved_by_id = current_user.id
    if data.severity is not None:
        alert.severity = data.severity

    await db.flush()
    await db.refresh(alert)
    return AlertResponse.model_validate(alert)
