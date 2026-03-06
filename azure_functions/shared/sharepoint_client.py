"""
SharePoint list client using Graph API.
Writes to the 8 lists on https://uluco.sharepoint.com/sites/uhtteam
"""
import os
import json
import uuid
import urllib.request
import urllib.parse
from datetime import datetime, timezone

TENANT_ID = os.getenv("SHAREPOINT_TENANT_ID")
CLIENT_ID = os.getenv("SHAREPOINT_CLIENT_ID")
CLIENT_SECRET = os.getenv("SHAREPOINT_CLIENT_SECRET")
SITE_URL = os.getenv("SHAREPOINT_SITE_URL", "https://uluco.sharepoint.com/sites/uhtteam")
SITE_ID = None  # cached after first call


def _get_token() -> str:
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    body = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials"
    }).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())["access_token"]


def _get_site_id(token: str) -> str:
    global SITE_ID
    if SITE_ID:
        return SITE_ID
    hostname = "uluco.sharepoint.com"
    path = "/sites/uhtteam"
    url = f"https://graph.microsoft.com/v1.0/sites/{hostname}:{path}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        SITE_ID = json.loads(resp.read())["id"]
    return SITE_ID


def _add_list_item(list_name: str, fields: dict) -> dict:
    token = _get_token()
    site_id = _get_site_id(token)
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/lists/{list_name}/items"
    body = json.dumps({"fields": fields}).encode()
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def write_email_draft(addressed_to: str, sender_persona: str, subject: str,
                      owner_email: str = "",
                      body: str, source_folder: str, client_name: str) -> str:
    draft_id = str(uuid.uuid4())[:8].upper()
    _add_list_item("EmailDrafts", {
        "Title": draft_id,
        "DraftId": draft_id,
        "AddressedTo": addressed_to,
        "SenderPersona": sender_persona,
        "Subject": subject,
        "Body": body,
        "Status": "Pending",
        "CreatedDate": datetime.now(timezone.utc).isoformat(),
        "SourceFolder": source_folder,
        "OwnerEmail": owner_email,
        "ClientName": client_name
    })
    return draft_id


def write_audit_log(action: str, performed_by: str, target_entity: str,
                    details: str, agent_name: str) -> None:
    log_id = str(uuid.uuid4())[:8].upper()
    _add_list_item("AuditLog", {
        "Title": log_id,
        "LogId": log_id,
        "Action": action,
        "PerformedBy": performed_by,
        "Timestamp": datetime.now(timezone.utc).isoformat(),
        "TargetEntity": target_entity,
        "Details": details,
        "AgentName": agent_name
    })
