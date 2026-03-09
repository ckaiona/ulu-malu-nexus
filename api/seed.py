"""Seed initial demo data (clients, agents, events, pentest run)."""
import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from .database import AsyncSessionLocal, Base, engine
from .models import (
    Agent, AgentStatus, Client, ClientStatus,
    EventSeverity, PentestRun, PentestStatus, SecurityEvent,
)

logger = logging.getLogger(__name__)

# ─── Demo seed data matching the UI mock data ─────────────────────────────────

CLIENTS = [
    {"name": "HEMIC",           "risk_score": 12, "status": ClientStatus.secure,   "churn_risk": 4,  "last_scan": "2d ago",  "industry": "Healthcare",    "mrr": 8500.0},
    {"name": "SentinelOne",     "risk_score": 34, "status": ClientStatus.warning,  "churn_risk": 23, "last_scan": "5d ago",  "industry": "Cybersecurity", "mrr": 12000.0},
    {"name": "Pacific Defense", "risk_score": 8,  "status": ClientStatus.secure,   "churn_risk": 2,  "last_scan": "1d ago",  "industry": "Defense",       "mrr": 15000.0},
    {"name": "KoreTech Labs",   "risk_score": 67, "status": ClientStatus.critical, "churn_risk": 61, "last_scan": "12d ago", "industry": "Technology",    "mrr": 6000.0},
    {"name": "HMSA",            "risk_score": 21, "status": ClientStatus.secure,   "churn_risk": 9,  "last_scan": "3d ago",  "industry": "Insurance",     "mrr": 18000.0},
    {"name": "First Hawaiian Bank", "risk_score": 45, "status": ClientStatus.warning, "churn_risk": 18, "last_scan": "7d ago", "industry": "Finance",    "mrr": 22000.0},
    {"name": "Kamehameha Schools",  "risk_score": 29, "status": ClientStatus.secure,  "churn_risk": 5,  "last_scan": "4d ago", "industry": "Education",  "mrr": 9500.0},
    {"name": "Queen's Health",      "risk_score": 18, "status": ClientStatus.secure,  "churn_risk": 7,  "last_scan": "2d ago", "industry": "Healthcare", "mrr": 11000.0},
]

AGENTS = [
    {"name": "PentestForge",          "status": AgentStatus.running,  "client_context": "HEMIC",            "progress_pct": 68,  "agent_type": "pentest",  "description": "External perimeter assessment engine"},
    {"name": "ScenarioHorizon",       "status": AgentStatus.running,  "client_context": "Q3 Modeling",      "progress_pct": 92,  "agent_type": "scenario", "description": "Financial scenario modeling and forecasting"},
    {"name": "ChurnSentinel",         "status": AgentStatus.idle,     "client_context": "Monitoring 18",    "progress_pct": 100, "agent_type": "churn",    "description": "Client churn risk scoring and alerts"},
    {"name": "InvoiceGuardian",       "status": AgentStatus.complete, "client_context": "Feb invoices",     "progress_pct": 100, "agent_type": "invoice",  "description": "Automated invoice review and anomaly detection"},
    {"name": "ThreatHorizon",         "status": AgentStatus.alert,    "client_context": "KoreTech Labs",    "progress_pct": 45,  "agent_type": "threat",   "description": "Real-time threat intelligence and IOC scanning"},
    {"name": "AgenticServiceBuilder", "status": AgentStatus.idle,     "client_context": "Standby",          "progress_pct": 0,   "agent_type": "service",  "description": "Autonomous service deployment and orchestration"},
]


async def seed(max_retries: int = 5) -> None:
    """Create tables and insert seed data if the DB is empty."""
    for attempt in range(max_retries):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            break
        except Exception as exc:
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                logger.warning("DB not ready (attempt %d/%d): %s — retrying in %ds", attempt + 1, max_retries, exc, wait)
                await asyncio.sleep(wait)
            else:
                logger.error("Failed to connect to database after %d attempts", max_retries)
                raise

    async with AsyncSessionLocal() as session:
        # Idempotency check
        existing = await session.scalar(select(Client).limit(1))
        if existing:
            logger.info("Database already seeded — skipping.")
            return

        logger.info("Seeding demo data...")

        # Clients
        client_map: dict[str, object] = {}
        for c_data in CLIENTS:
            c = Client(**c_data)
            session.add(c)
            await session.flush()
            client_map[c_data["name"]] = c.id

        # Agents
        ts = datetime.utcnow().isoformat()
        for a_data in AGENTS:
            a = Agent(**a_data, logs=[f"[{ts}] Agent initialized (seed)"])
            session.add(a)

        # Security events
        events = [
            SecurityEvent(
                client_id=client_map.get("KoreTech Labs"),
                title="CRITICAL: Exposed Admin Panel",
                description="Port 8443 admin interface reachable from public internet with default credentials detected.",
                severity=EventSeverity.critical,
                event_type="threat",
                resolved=False,
            ),
            SecurityEvent(
                client_id=client_map.get("SentinelOne"),
                title="WARNING: SSL Certificates Expiring",
                description="3 certificates expire within 30 days — renewal required.",
                severity=EventSeverity.medium,
                event_type="audit",
                resolved=False,
            ),
            SecurityEvent(
                client_id=client_map.get("HEMIC"),
                title="SOC2 Type II Audit Completed",
                description="Annual SOC2 audit passed with zero findings. Report archived.",
                severity=EventSeverity.low,
                event_type="compliance",
                resolved=True,
                created_at=datetime.utcnow() - timedelta(days=5),
            ),
            SecurityEvent(
                title="ThreatHorizon: CVE-2024-44871 Pattern Detected",
                description="nginx < 1.26.1 vulnerability found across 3 client environments.",
                severity=EventSeverity.high,
                event_type="threat",
                resolved=False,
            ),
            SecurityEvent(
                client_id=client_map.get("First Hawaiian Bank"),
                title="Anomalous Login Pattern",
                description="Multiple failed SSH attempts from 185.220.x.x (Tor exit node) blocked.",
                severity=EventSeverity.high,
                event_type="threat",
                resolved=False,
            ),
            SecurityEvent(
                client_id=client_map.get("KoreTech Labs"),
                title="Churn Risk Escalated",
                description="ChurnSentinel scored KoreTech at 61% churn probability. Exec review recommended.",
                severity=EventSeverity.medium,
                event_type="churn",
                resolved=False,
            ),
        ]
        for ev in events:
            session.add(ev)

        # A sample pentest run
        hemic_id = client_map.get("HEMIC")
        if hemic_id:
            session.add(PentestRun(
                client_id=hemic_id,
                title="External Perimeter Assessment — Q1 2026",
                scope="External IP ranges, public web apps, API endpoints, DNS",
                governance="soc2",
                status=PentestStatus.running,
                progress_pct=68,
                started_at=datetime.utcnow() - timedelta(hours=2),
            ))

        koretech_id = client_map.get("KoreTech Labs")
        if koretech_id:
            session.add(PentestRun(
                client_id=koretech_id,
                title="Critical Infrastructure Review",
                scope="Internal network, VPN, cloud config",
                governance="standard",
                status=PentestStatus.pending,
                progress_pct=0,
            ))

        await session.commit()
        logger.info("Seed complete: %d clients, %d agents, %d events.", len(CLIENTS), len(AGENTS), len(events))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
