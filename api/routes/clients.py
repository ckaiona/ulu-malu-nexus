import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth, require_role, TokenData
from ..database import get_db
from ..models import Client, ClientStatus, SecurityEvent, PentestRun

router = APIRouter(prefix="/clients", tags=["clients"])


def _client_dict(c: Client) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "risk": c.risk_score,
        "status": c.status.value,
        "churn": c.churn_risk,
        "last": c.last_scan,
        "industry": c.industry,
        "mrr": c.mrr,
        "active": c.active,
        "notes": c.notes,
        "contact_email": c.contact_email,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


class ClientCreate(BaseModel):
    name: str
    risk_score: int = 0
    status: ClientStatus = ClientStatus.secure
    churn_risk: int = 0
    last_scan: str = "Never"
    industry: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    mrr: float = 0.0


class ClientUpdate(BaseModel):
    risk_score: Optional[int] = None
    status: Optional[ClientStatus] = None
    churn_risk: Optional[int] = None
    last_scan: Optional[str] = None
    industry: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    mrr: Optional[float] = None
    active: Optional[bool] = None


@router.get("/")
async def list_clients(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(require_auth),
):
    q = select(Client).order_by(Client.risk_score.desc())
    if active_only:
        q = q.where(Client.active == True)
    result = await db.execute(q)
    return [_client_dict(c) for c in result.scalars()]


@router.get("/{client_id}")
async def get_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(require_auth),
):
    c = await db.get(Client, client_id)
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")

    # Include recent events
    ev_result = await db.execute(
        select(SecurityEvent)
        .where(SecurityEvent.client_id == client_id)
        .order_by(SecurityEvent.created_at.desc())
        .limit(5)
    )
    events = [
        {
            "id": str(e.id),
            "title": e.title,
            "severity": e.severity.value,
            "event_type": e.event_type,
            "resolved": e.resolved,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in ev_result.scalars()
    ]

    # Include recent pentest runs
    pr_result = await db.execute(
        select(PentestRun)
        .where(PentestRun.client_id == client_id)
        .order_by(PentestRun.created_at.desc())
        .limit(3)
    )
    runs = [
        {
            "id": str(r.id),
            "title": r.title,
            "status": r.status.value,
            "progress_pct": r.progress_pct,
            "governance": r.governance,
            "started_at": r.started_at.isoformat() if r.started_at else None,
        }
        for r in pr_result.scalars()
    ]

    detail = _client_dict(c)
    detail["events"] = events
    detail["pentest_runs"] = runs
    return detail


@router.post("/", status_code=201)
async def create_client(
    data: ClientCreate,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(require_role("operator")),
):
    c = Client(**data.model_dump())
    db.add(c)
    await db.flush()
    return _client_dict(c)


@router.patch("/{client_id}")
async def update_client(
    client_id: uuid.UUID,
    data: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(require_role("operator")),
):
    c = await db.get(Client, client_id)
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    await db.flush()
    return _client_dict(c)


@router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(require_role("admin")),
):
    c = await db.get(Client, client_id)
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    c.active = False  # soft delete
    await db.flush()
