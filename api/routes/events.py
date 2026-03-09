from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth, TokenData
from ..database import get_db
from ..models import EventSeverity, SecurityEvent

router = APIRouter(prefix="/events", tags=["events"])


def _event_dict(e: SecurityEvent) -> dict:
    return {
        "id": str(e.id),
        "client_id": str(e.client_id) if e.client_id else None,
        "title": e.title,
        "description": e.description,
        "severity": e.severity.value,
        "event_type": e.event_type,
        "resolved": e.resolved,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("/")
async def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    severity: Optional[EventSeverity] = None,
    event_type: Optional[str] = None,
    resolved: Optional[bool] = None,
    client_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(require_auth),
):
    q = select(SecurityEvent).order_by(SecurityEvent.created_at.desc())

    if severity:
        q = q.where(SecurityEvent.severity == severity)
    if event_type:
        q = q.where(SecurityEvent.event_type == event_type)
    if resolved is not None:
        q = q.where(SecurityEvent.resolved == resolved)
    if client_id:
        q = q.where(SecurityEvent.client_id == client_id)

    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    items = [_event_dict(e) for e in result.scalars()]

    return {"items": items, "page": page, "page_size": page_size}


@router.patch("/{event_id}/resolve")
async def resolve_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(require_auth),
):
    import uuid
    e = await db.get(SecurityEvent, uuid.UUID(event_id))
    if not e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Event not found")
    e.resolved = True
    await db.flush()
    return _event_dict(e)
