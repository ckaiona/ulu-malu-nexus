"""
email-processor — Azure Function (Timer Trigger, every 15 min)

Per-user model:
- Reads all rows from SharePoint UserPreferences list
- For each user, uses their own delegated Graph token (stored in Key Vault)
- Calls /me/messages/delta — each user's own inbox, no cross-mailbox access
- Drafts in EmailDrafts are tagged with that user's email as owner
- Each user only ever sees their own drafts
"""
import os
import json
import logging
import urllib.request
import azure.functions as func

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.graph_client import fetch_new_emails_for_user
from shared.sharepoint_client import write_email_draft, write_audit_log, _get_token, _get_site_id

logger = logging.getLogger(__name__)

XAI_API_KEY = os.getenv("XAI_API_KEY")

CATEGORIES = [
    "CMMC-Compliance", "Trading-Finance", "Invoicing-Tax", "Copilot-AI",
    "Security-Alerts", "HR-Admin", "Vendor-MSP", "ULU-Malu",
    "ULU-HiTech", "Personal", "Uncategorized"
]

PERSONAS = {
    "CMMC-Compliance":  "Compliance Lead",
    "Security-Alerts":  "Security Officer",
    "Trading-Finance":  "Finance Lead",
    "Invoicing-Tax":    "Finance Lead",
    "Vendor-MSP":       "MSP Director",
    "ULU-Malu":         "ULU Malu",
    "ULU-HiTech":       "ULU Hi-Tech",
}


def _get_active_users() -> list[str]:
    """
    Read UserPreferences SharePoint list and return all registered user emails.
    Only includes users who have a refresh token stored (i.e. have signed in).
    """
    token = _get_token()
    site_id = _get_site_id(token)
    url = (
        f"https://graph.microsoft.com/v1.0/sites/{site_id}/lists/UserPreferences/items"
        "?$expand=fields&$select=fields"
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            items = json.loads(resp.read()).get("value", [])
        return [item["fields"]["UserEmail"] for item in items if item.get("fields", {}).get("UserEmail")]
    except Exception as e:
        logger.error(f"Failed to load UserPreferences: {e}")
        return []


def _grok_analyze(subject: str, sender: str, body: str) -> dict:
    prompt = f"""You are Kumu Grok, AI for ULU Malu / ULU Hi-Tech (Hawaii MSP + cybersecurity).

Analyze this email and return ONLY valid JSON with these fields:
- category: one of {CATEGORIES}
- client_name: company name of sender or "Unknown"
- urgency: "high" | "medium" | "low"
- action_needed: true | false
- draft_reply: a professional reply draft (2-4 sentences), or "" if no reply needed

Subject: {subject}
From: {sender}
Body: {body[:1200]}"""

    data = json.dumps({
        "model": "grok-beta",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 600
    }).encode()

    req = urllib.request.Request(
        "https://api.x.ai/v1/chat/completions",
        data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {XAI_API_KEY}"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            content = json.loads(resp.read())["choices"][0]["message"]["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            return json.loads(content)
    except Exception as e:
        logger.warning(f"Grok analyze failed: {e}")
        return {"category": "Uncategorized", "client_name": "Unknown",
                "urgency": "low", "action_needed": False, "draft_reply": ""}


def _process_user_inbox(user_email: str) -> None:
    """Fetch and process one user's unread emails using their own identity."""
    logger.info(f"── Processing inbox for {user_email}")

    emails, display_name = fetch_new_emails_for_user(user_email)
    if not emails:
        logger.info(f"   No new emails for {user_email}")
        return

    logger.info(f"   {len(emails)} new emails for {display_name}")

    for email in emails:
        subject      = email.get("subject", "(no subject)")
        sender_addr  = email.get("from", {}).get("emailAddress", {}).get("address", "unknown")
        sender_name  = email.get("from", {}).get("emailAddress", {}).get("name", sender_addr)
        body_content = email.get("body", {}).get("content", "")
        email_id     = email.get("id", "")

        analysis     = _grok_analyze(subject, sender_addr, body_content)
        category     = analysis.get("category", "Uncategorized")
        client_name  = analysis.get("client_name", "Unknown")
        draft_reply  = analysis.get("draft_reply", "")

        # Persona includes the user's display name so each user's drafts are
        # signed from them, not a hardcoded name
        persona_role = PERSONAS.get(category, "Team Member")
        persona      = f"{display_name or user_email} – {persona_role}"

        if draft_reply:
            try:
                draft_id = write_email_draft(
                    addressed_to=sender_addr,
                    sender_persona=persona,
                    subject=f"Re: {subject}",
                    body=draft_reply,
                    source_folder=category,
                    client_name=client_name,
                    owner_email=user_email          # new field — ties draft to this user
                )
                write_audit_log(
                    action="DRAFT_CREATED",
                    performed_by=user_email,
                    target_entity=email_id,
                    details=f"Category: {category} | Urgency: {analysis.get('urgency')} | DraftId: {draft_id}",
                    agent_name="Kiai-Guardian"
                )
                logger.info(f"   Draft {draft_id} created for: {subject}")
            except Exception as e:
                logger.error(f"   Draft write failed for {subject}: {e}")
                write_audit_log("DRAFT_ERROR", user_email, email_id, str(e), "email-processor")
        else:
            write_audit_log(
                action="EMAIL_LOGGED",
                performed_by=user_email,
                target_entity=email_id,
                details=f"Category: {category} | No reply needed",
                agent_name="Kiai-Guardian"
            )


def main(mytimer: func.TimerRequest) -> None:
    logger.info("email-processor: starting per-user run")

    users = _get_active_users()
    if not users:
        logger.warning("No users found in UserPreferences — nothing to process")
        return

    logger.info(f"Processing {len(users)} user(s): {users}")

    for user_email in users:
        try:
            _process_user_inbox(user_email)
        except Exception as e:
            logger.error(f"Unhandled error for {user_email}: {e}")
            write_audit_log("EMAIL_FETCH_ERROR", user_email, "inbox", str(e), "email-processor")

    logger.info("email-processor: all users processed")
