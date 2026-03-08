#!/usr/bin/env python3
"""
watch_graph.py — polls YOUR M365 inbox via Graph API, generates AI reply
drafts with Kia'i memory, and saves them as real Outlook drafts + to
Azure Table Storage (NexusDrafts) so NEXUS Drafts page shows them live.

Personal use only — authenticates as YOU via device-code flow (MSAL).
Token is cached in ~/.ulu_token_cache.json so subsequent runs are silent.

First run:
  export ANTHROPIC_API_KEY=sk-ant-...
  .venv/bin/python3 watch_graph.py

You'll be prompted once to sign in at https://microsoft.com/devicelogin.
After that it runs silently every POLL_SECS seconds.

Launched automatically by launchd plist (same as watch_drafts.py but
set ProgramArguments to watch_graph.py instead).

Required env vars:
  ANTHROPIC_API_KEY          — Claude API key
  AZURE_CLIENT_ID            — App registration client ID (delegated, Mail.Read + Mail.ReadWrite + offline_access)
  AZURE_TENANT_ID            — Your M365 tenant ID

Optional env vars:
  MEMORY_STORAGE_CONNECTION  — Azure Storage connection string (for NexusDrafts + KiaiMemories)
  POLL_SECS                  — Poll interval in seconds (default: 60)
"""

import os, sys, json, hashlib, datetime, time, logging
from pathlib import Path
from urllib.request import Request, urlopen

from azure.identity import DefaultAzureCredential, AzureCliCredential
from kiai_memory import get_memories, save_memory, format_for_prompt

# ── Config ─────────────────────────────────────────────────────────────────────
SCRIPTS_DIR        = Path(__file__).parent
LOG_FILE           = SCRIPTS_DIR / "watch_graph.log"
POLL_SECS          = int(os.environ.get("POLL_SECS", "60"))
ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
OWNER              = os.environ.get("OWNER_EMAIL", "caiona@ulumalusystems.com")

GRAPH_SCOPE = "https://graph.microsoft.com/.default"

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger("watch_graph")

# ── Auth — uses your existing `az login` session, no app registration needed ───
_credential = None

def get_access_token():
    global _credential
    if _credential is None:
        # AzureCliCredential picks up `az login` directly
        _credential = AzureCliCredential()
    token = _credential.get_token(GRAPH_SCOPE)
    return token.token

# ── Graph API helpers ──────────────────────────────────────────────────────────
def graph_get(token, path):
    req = Request(
        f"https://graph.microsoft.com/v1.0{path}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def graph_post(token, path, body):
    data = json.dumps(body).encode()
    req = Request(
        f"https://graph.microsoft.com/v1.0{path}",
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def graph_patch(token, path, body):
    data = json.dumps(body).encode()
    req = Request(
        f"https://graph.microsoft.com/v1.0{path}",
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="PATCH",
    )
    with urlopen(req, timeout=30) as r:
        return r.read()

def get_unread_emails(token, top=10):
    """Fetch unread inbox messages, newest first."""
    result = graph_get(
        token,
        f"/me/mailFolders/inbox/messages"
        f"?$filter=isRead eq false"
        f"&$orderby=receivedDateTime desc"
        f"&$top={top}"
        f"&$select=id,subject,from,toRecipients,body,receivedDateTime"
    )
    return result.get("value", [])

def mark_as_read(token, msg_id):
    graph_patch(token, f"/me/messages/{msg_id}", {"isRead": True})

def create_outlook_draft(token, msg_id, draft_body_text, subject, sender_email):
    """Save reply draft back into Outlook."""
    try:
        reply = graph_post(token, f"/me/messages/{msg_id}/createReply", {})
        draft_id = reply["id"]
        graph_patch(token, f"/me/messages/{draft_id}", {
            "body": {"contentType": "Text", "content": draft_body_text},
            "subject": f"Re: {subject}" if not subject.startswith("Re:") else subject,
        })
        log.info(f"  Outlook draft saved (id={draft_id[:16]}...)")
        return draft_id
    except Exception as e:
        log.warning(f"  Could not create Outlook draft: {e}")
        return None

# ── Azure Table Storage (NexusDrafts) ─────────────────────────────────────────
def _nexus_table_client():
    conn = os.environ.get(
        "MEMORY_STORAGE_CONNECTION",
        "DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;"
        "AccountName=ulunexusmemory;"
        "AccountKey=N4NRdg5ThLrtL1V6WxZ8Q9DziVT+6fj+6raiLaA7U1Fue2fKXLUGhYiL4xxyrdxOd3ZFA6jh6Hm0+ASt2n3JNA=="
    )
    from azure.data.tables import TableServiceClient
    svc = TableServiceClient.from_connection_string(conn)
    try:
        svc.create_table("NexusDrafts")
    except Exception:
        pass
    return svc.get_table_client("NexusDrafts")

def save_nexus_draft(draft_id, subject, sender, body, draft_body, outlook_draft_id=None):
    try:
        tc  = _nexus_table_client()
        rev = str(9999999999999 - int(datetime.datetime.utcnow().timestamp() * 1000)).zfill(13)
        rnd = hashlib.md5(draft_id.encode()).hexdigest()[:5]
        tc.upsert_entity({
            "PartitionKey":    "draft",
            "RowKey":          f"{rev}-{rnd}",
            "DraftId":         draft_id,
            "OwnerEmail":      OWNER,
            "AddressedTo":     sender,
            "Subject":         f"Re: {subject}" if not subject.startswith("Re:") else subject,
            "SenderPersona":   "Camille Aiona – Lead AI Architect",
            "ClientName":      sender.split("<")[0].strip() or sender,
            "Status":          "Pending",
            "Body":            draft_body,
            "OriginalBody":    body[:500],
            "OutlookDraftId":  outlook_draft_id or "",
            "createdAt":       datetime.datetime.utcnow().isoformat(),
        })
        log.info(f"  NexusDrafts saved → '{subject[:60]}'")
    except Exception as e:
        log.warning(f"  NexusDrafts save failed: {e}")

# ── AI draft generation ────────────────────────────────────────────────────────
def generate_draft(subject, sender, body_text, client=""):
    if not ANTHROPIC_API_KEY:
        log.warning("ANTHROPIC_API_KEY not set — skipping AI draft")
        return f"[AI draft unavailable — set ANTHROPIC_API_KEY]\n\nRe: {subject}"

    memories  = get_memories(client=client, top=20)
    mem_block = format_for_prompt(memories)
    system = (
        "You are Kia'i, the AI assistant for ULU Malu Systems. "
        "Draft a concise, professional email reply on behalf of Camille Aiona. "
        "Be warm, direct, and action-oriented. No timelines or dates. "
        "Reply in plain text only — no markdown."
        + (f"\n\n{mem_block}" if mem_block else "")
    )
    payload = json.dumps({
        "model":      "claude-opus-4-6",
        "max_tokens": 512,
        "system":     system,
        "messages":   [{"role": "user", "content":
            f"Draft a reply to this email.\n\nFrom: {sender}\nSubject: {subject}\n\n{body_text}"
        }],
    }).encode()
    req = Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key":          ANTHROPIC_API_KEY,
            "anthropic-version":  "2023-06-01",
            "content-type":       "application/json",
        },
        method="POST",
    )
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read())["content"][0]["text"]

# ── Per-message processing ─────────────────────────────────────────────────────
def process_message(token, msg):
    msg_id    = msg["id"]
    subject   = msg.get("subject", "(no subject)")
    sender    = msg.get("from", {}).get("emailAddress", {})
    sender_name  = sender.get("name", "")
    sender_email = sender.get("address", "")
    sender_str   = f"{sender_name} <{sender_email}>" if sender_name else sender_email
    client_name  = sender_name or sender_email

    body_content = msg.get("body", {}).get("content", "")
    # Strip HTML tags roughly for plain text
    import re
    body_text = re.sub(r"<[^>]+>", " ", body_content)
    body_text = re.sub(r"\s+", " ", body_text).strip()[:3000]

    draft_id = hashlib.md5(msg_id.encode()).hexdigest()[:12]
    log.info(f"New email [{draft_id}]: {subject[:60]} — from {sender_str[:50]}")

    try:
        log.info("  Generating AI draft...")
        draft_body = generate_draft(subject, sender_str, body_text, client=client_name)

        outlook_draft_id = create_outlook_draft(token, msg_id, draft_body, subject, sender_email)
        save_nexus_draft(draft_id, subject, sender_str, body_text, draft_body, outlook_draft_id)
        save_memory(
            f"Drafted reply to '{subject[:80]}' from {client_name}",
            type="draft", client=client_name, page="drafts", importance=3,
        )
        mark_as_read(token, msg_id)
        log.info("  Done — marked as read.")
    except Exception as e:
        log.error(f"  FAILED: {e}")

# ── Main watcher loop ──────────────────────────────────────────────────────────
def watch():
    log.info("Authenticating via az login session...")
    token = get_access_token()
    me = graph_get(token, "/me?$select=displayName,mail")
    log.info(f"Signed in as: {me.get('displayName')} <{me.get('mail')}>")
    log.info(f"Polling inbox every {POLL_SECS}s. Ctrl+C to stop.")

    while True:
        try:
            token = get_access_token()  # refresh silently each loop
            messages = get_unread_emails(token, top=10)
            if messages:
                log.info(f"Found {len(messages)} unread email(s).")
                for msg in messages:
                    process_message(token, msg)
            else:
                log.debug("No new emails.")
        except Exception as e:
            log.error(f"Poll error: {e}")
        time.sleep(POLL_SECS)

if __name__ == "__main__":
    watch()
