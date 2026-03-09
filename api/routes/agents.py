import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth, require_role, TokenData
from ..database import get_db
from ..models import Agent, AgentStatus

router = APIRouter(prefix="/agents", tags=["agents"])


def _agent_dict(a: Agent) -> dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "status": a.status.value,
        "client": a.client_context,
        "pct": a.progress_pct,
        "description": a.description,
        "agent_type": a.agent_type,
        "last_active": a.last_active.isoformat() if a.last_active else None,
        "logs": (a.logs or [])[-20:],  # last 20 entries
    }


class AgentAction(BaseModel):
    action: str  # start | stop | reset
    client_context: Optional[str] = None


@router.get("/")
async def list_agents(
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(require_auth),
):
    result = await db.execute(select(Agent).order_by(Agent.name))
    return [_agent_dict(a) for a in result.scalars()]


@router.get("/{agent_id}")
async def get_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(require_auth),
):
    a = await db.get(Agent, agent_id)
    if not a:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _agent_dict(a)


@router.post("/{agent_id}/action")
async def agent_action(
    agent_id: uuid.UUID,
    payload: AgentAction,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(require_role("operator")),
):
    a = await db.get(Agent, agent_id)
    if not a:
        raise HTTPException(status_code=404, detail="Agent not found")

    ts = datetime.utcnow().isoformat()
    logs = list(a.logs or [])

    if payload.action == "start":
        a.status = AgentStatus.running
        a.progress_pct = 0
        if payload.client_context:
            a.client_context = payload.client_context
        logs.append(f"[{ts}] Agent started by {user.email}")
    elif payload.action == "stop":
        a.status = AgentStatus.idle
        logs.append(f"[{ts}] Agent stopped by {user.email}")
    elif payload.action == "reset":
        a.status = AgentStatus.idle
        a.progress_pct = 0
        logs = [f"[{ts}] Agent reset by {user.email}"]
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {payload.action}")

    a.logs = logs
    a.last_active = datetime.utcnow()
    await db.flush()
    return _agent_dict(a)
