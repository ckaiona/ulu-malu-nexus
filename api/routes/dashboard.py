from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, TokenData
from ..database import get_db
from ..models import Agent, AgentStatus, Client, ClientStatus, PentestRun, PentestStatus, SecurityEvent

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):
    active_clients = await db.scalar(
        select(func.count()).select_from(Client).where(Client.active == True)
    )
    active_pentests = await db.scalar(
        select(func.count()).select_from(PentestRun).where(
            PentestRun.status == PentestStatus.running
        )
    )
    awaiting_pentests = await db.scalar(
        select(func.count()).select_from(PentestRun).where(
            PentestRun.status == PentestStatus.pending
        )
    )
    open_threats = await db.scalar(
        select(func.count()).select_from(SecurityEvent).where(
            and_(SecurityEvent.event_type == "threat", SecurityEvent.resolved == False)
        )
    )
    critical_client = await db.scalar(
        select(Client.name).where(Client.status == ClientStatus.critical).limit(1)
    )
    total_mrr = await db.scalar(
        select(func.sum(Client.mrr)).where(Client.active == True)
    ) or 0.0

    running_agents = await db.scalar(
        select(func.count()).select_from(Agent).where(Agent.status == AgentStatus.running)
    )

    return {
        "active_clients": active_clients or 0,
        "active_pentests": active_pentests or 0,
        "awaiting_pentests": awaiting_pentests or 0,
        "open_threats": open_threats or 0,
        "critical_client": critical_client or "None",
        "mrr": round(total_mrr, 2),
        "running_agents": running_agents or 0,
    }
