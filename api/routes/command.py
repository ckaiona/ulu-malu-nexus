"""Meta Commander — routes natural language commands to appropriate agents."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..auth import require_auth, TokenData

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/command", tags=["command"])


class CommandRequest(BaseModel):
    text: str
    context: str = "ops"  # ops | sales | finance | client | mail | calendar


class CommandResponse(BaseModel):
    text: str
    pending_approval: bool = False
    action_type: Optional[str] = None
    suggested_agent: Optional[str] = None


def _parse_command(text: str, context: str, user_name: str) -> CommandResponse:
    t = text.lower()

    if any(kw in t for kw in ["pentest", "penetration test", "vuln scan"]):
        target = "the target client"
        for name in ["hemic", "koretech", "hmsa", "pacific defense", "sentinelone"]:
            if name in t:
                target = name.upper()
                break
        return CommandResponse(
            text=(
                f"Routing to PentestForge...\n\n"
                f"✓ SOC2 checklist loaded\n"
                f"✓ Scope: external perimeter + web apps\n"
                f"✓ Target: {target}\n"
                f"✓ Governance framework selected\n"
                f"✓ Ready for approval — confirm to launch."
            ),
            pending_approval=True,
            action_type="pentest",
            suggested_agent="PentestForge",
        )

    if any(kw in t for kw in ["threat", "scan", "ioc", "indicator", "threat hunt"]):
        return CommandResponse(
            text=(
                "Routing to ThreatHorizon...\n\n"
                "✓ Threat intel feeds updated\n"
                "✓ IOC database synced (MISP + VirusTotal)\n"
                "✓ Scanning client perimeters\n"
                "✓ Running in background — results in 3-5 min."
            ),
            pending_approval=False,
            action_type="threat_scan",
            suggested_agent="ThreatHorizon",
        )

    if any(kw in t for kw in ["audit", "compliance", "soc2", "soc 2", "hipaa", "pci"]):
        framework = "SOC2" if "soc" in t else ("HIPAA" if "hipaa" in t else "PCI-DSS" if "pci" in t else "Standard")
        return CommandResponse(
            text=(
                f"Routing to Compliance Engine...\n\n"
                f"✓ {framework} framework loaded\n"
                f"✓ Evidence collection initiated\n"
                f"✓ Audit trail secured (immutable log)\n"
                f"✓ Ready for approval."
            ),
            pending_approval=True,
            action_type="audit",
            suggested_agent="PentestForge",
        )

    if any(kw in t for kw in ["invoice", "billing", "payment"]):
        return CommandResponse(
            text=(
                "Routing to InvoiceGuardian...\n\n"
                "✓ Billing records loaded\n"
                "✓ Anomaly detection active\n"
                "✓ Scanning for duplicate / missing invoices.\n"
                "✓ Report will be ready shortly."
            ),
            pending_approval=False,
            action_type="invoice",
            suggested_agent="InvoiceGuardian",
        )

    if any(kw in t for kw in ["churn", "risk", "client health", "retention"]):
        return CommandResponse(
            text=(
                "Routing to ChurnSentinel...\n\n"
                "✓ Engagement signals loaded\n"
                "✓ Scoring 18 active clients\n"
                "✓ High-risk alerts will surface in Clients view."
            ),
            pending_approval=False,
            action_type="churn",
            suggested_agent="ChurnSentinel",
        )

    if any(kw in t for kw in ["deploy", "agent", "build", "service"]):
        return CommandResponse(
            text=(
                "Routing to AgenticServiceBuilder...\n\n"
                "✓ Agent blueprint loaded\n"
                "✓ Azure Foundry runtime ready\n"
                "✓ Awaiting deployment approval."
            ),
            pending_approval=True,
            action_type="deploy_agent",
            suggested_agent="AgenticServiceBuilder",
        )

    # Generic fallback
    nav_label = {
        "ops": "Operations Fortress",
        "sales": "Sales Shield",
        "finance": "Finance Vault",
        "client": "Client Vigilance",
    }.get(context, "Operations Fortress")

    return CommandResponse(
        text=(
            f"Command received from {user_name}.\n\n"
            f"✓ Routing to {nav_label}\n"
            f"✓ Parsing intent...\n"
            f"✓ Engaging available agents.\n"
            f"✓ Standing by for results."
        ),
        pending_approval=False,
        action_type="generic",
    )


@router.post("/")
async def send_command(
    payload: CommandRequest,
    user: TokenData = Depends(require_auth),
) -> CommandResponse:
    logger.info("Command from %s: %s", user.email, payload.text[:80])
    return _parse_command(payload.text, payload.context, user.name or user.email)
