import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Enum as SAEnum, Float, ForeignKey,
    Integer, JSON, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class ClientStatus(str, enum.Enum):
    secure = "secure"
    warning = "warning"
    critical = "critical"


class AgentStatus(str, enum.Enum):
    running = "running"
    idle = "idle"
    alert = "alert"
    complete = "complete"


class PentestStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    complete = "complete"
    failed = "failed"


class EventSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entra_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    roles: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[ClientStatus] = mapped_column(SAEnum(ClientStatus), default=ClientStatus.secure)
    churn_risk: Mapped[int] = mapped_column(Integer, default=0)
    last_scan: Mapped[str] = mapped_column(String(50), default="Never")
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mrr: Mapped[float] = mapped_column(Float, default=0.0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    events: Mapped[list["SecurityEvent"]] = relationship(
        "SecurityEvent", back_populates="client", cascade="all, delete-orphan"
    )
    pentest_runs: Mapped[list["PentestRun"]] = relationship(
        "PentestRun", back_populates="client", cascade="all, delete-orphan"
    )


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    severity: Mapped[EventSeverity] = mapped_column(SAEnum(EventSeverity), default=EventSeverity.medium)
    # threat | audit | compliance | pentest
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    extra: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    client: Mapped[Optional["Client"]] = relationship("Client", back_populates="events")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    status: Mapped[AgentStatus] = mapped_column(SAEnum(AgentStatus), default=AgentStatus.idle)
    client_context: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # pentest | threat | churn | invoice | scenario | service
    agent_type: Mapped[str] = mapped_column(String(100))
    last_active: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    logs: Mapped[list] = mapped_column(JSON, default=list)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PentestRun(Base):
    __tablename__ = "pentest_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    scope: Mapped[str] = mapped_column(Text)
    # standard | soc2 | hipaa | pci | iso27001
    governance: Mapped[str] = mapped_column(String(100), default="standard")
    status: Mapped[PentestStatus] = mapped_column(SAEnum(PentestStatus), default=PentestStatus.pending)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    client: Mapped["Client"] = relationship("Client", back_populates="pentest_runs")
