#!/usr/bin/env python3
"""
watch_drafts.py — watches ~/Downloads/eml_export/ULU-Malu/ for new .eml files.
When a new file lands, generates an AI reply draft and saves it to Azure Table Storage
(NexusDrafts table) so NEXUS Drafts page shows it immediately.

Runs as a background daemon via launchd.
Processed emails are moved to a 'processed/' subfolder so they're never re-drafted.

Usage (manual):
  cd /path/to/scripts
  ANTHROPIC_API_KEY=sk-ant-... .venv/bin/python3 watch_drafts.py

Launched automatically by: ~/Library/LaunchAgents/com.ulumalu.nexus.emailwatcher.plist
"""

import os, sys, time, shutil, email, json, hashlib, datetime, logging
from email.header import decode_header
from email.policy import default as email_policy
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError
from azure.data.tables import TableServiceClient

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPTS_DIR = Path(__file__).parent
WATCH_DIR   = Path.home() / "Downloads/eml_export/ULU-Malu"
DONE_DIR    = WATCH_DIR / "processed"
LOG_FILE    = SCRIPTS_DIR / "watch_drafts.log"
POLL_SECS   = 30   # check every 30 seconds

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
STORAGE_CONN      = os.environ.get(
    "MEMORY_STORAGE_CONNECTION",
    "DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;"
    "AccountName=ulunexusmemory;"
    "AccountKey=N4NRdg5ThLrtL1V6WxZ8Q9DziVT+6fj+6raiLaA7U1Fue2fKXLUGhYiL4xxyrdxOd3ZFA6jh6Hm0+ASt2n3JNA=="
)
TABLE = "NexusDrafts"
OWNER = "caiona@ulumalusystems.com"

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger("watch_drafts")

# ── Email helpers ─────────────────────────────────────────────────────────────
def decode_str(s):
    if not s: return ""
    parts = decode_header(s)
    out = []
    for part, enc in parts:
        if isinstance(part, bytes):
            out.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            out.append(part)
    return "".join(out)

def parse_eml(path):
    with open(path, "rb") as f:
        msg = email.message_from_binary_file(f, policy=email_policy)
    subject = decode_str(msg.get("Subject", "(no subject)"))
    sender  = decode_str(msg.get("From", "unknown"))
    to      = decode_str(msg.get("To", ""))
    body    = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body = part.get_content()
                break
    else:
        body = msg.get_content() or ""
    return subject, sender, to, body[:3000]

# ── AI draft generation ───────────────────────────────────────────────────────
def generate_draft(subject, sender, body):
    if not ANTHROPIC_API_KEY:
        log.warning("ANTHROPIC_API_KEY not set — storing placeholder draft")
        return f"[AI draft unavailable — set ANTHROPIC_API_KEY]\n\nRe: {subject}"
    payload = json.dumps({
        "model": "claude-opus-4-6",
        "max_tokens": 512,
        "system": (
            "You are Kia'i, the AI assistant for ULU Malu Systems. "
            "Draft a concise, professional email reply on behalf of Camille Aiona. "
            "Be warm, direct, and action-oriented. No timelines or dates. "
            "Reply in plain text only — no markdown."
        ),
        "messages": [{
            "role": "user",
            "content": f"Draft a reply to this email.\n\nFrom: {sender}\nSubject: {subject}\n\n{body}"
        }]
    }).encode()
    req = Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST"
    )
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read())["content"][0]["text"]

# ── Azure Table Storage ───────────────────────────────────────────────────────
def get_table_client():
    svc = TableServiceClient.from_connection_string(STORAGE_CONN)
    try:
        svc.create_table(TABLE)
    except Exception:
        pass
    return svc.get_table_client(TABLE)

def save_draft(tc, draft_id, subject, sender, to, body, draft_body):
    rev  = str(9999999999999 - int(datetime.datetime.utcnow().timestamp() * 1000)).zfill(13)
    rand = hashlib.md5(draft_id.encode()).hexdigest()[:5]
    entity = {
        "PartitionKey": "draft",
        "RowKey": f"{rev}-{rand}",
        "DraftId":       draft_id,
        "OwnerEmail":    OWNER,
        "AddressedTo":   sender,
        "Subject":       f"Re: {subject}" if not subject.startswith("Re:") else subject,
        "SenderPersona": "Camille Aiona – Lead AI Architect",
        "ClientName":    sender.split("<")[0].strip() or sender,
        "Status":        "Pending",
        "Body":          draft_body,
        "OriginalBody":  body[:500],
        "createdAt":     datetime.datetime.utcnow().isoformat(),
    }
    tc.upsert_entity(entity)
    log.info(f"  Saved draft {draft_id} → '{entity['Subject'][:60]}'")

# ── Watcher loop ──────────────────────────────────────────────────────────────
def process_file(tc, path):
    draft_id = hashlib.md5(str(path.name).encode()).hexdigest()[:12]
    log.info(f"New email: {path.name}  [{draft_id}]")
    try:
        subject, sender, to, body = parse_eml(path)
        log.info(f"  Subject: {subject[:60]}")
        log.info(f"  From:    {sender[:50]}")
        log.info(f"  Generating AI draft...")
        draft_body = generate_draft(subject, sender, body)
        save_draft(tc, draft_id, subject, sender, to, body, draft_body)
        # Move to processed/
        DONE_DIR.mkdir(exist_ok=True)
        dest = DONE_DIR / path.name
        if dest.exists():
            dest = DONE_DIR / (path.stem + f"_{draft_id}" + path.suffix)
        shutil.move(str(path), str(dest))
        log.info(f"  Moved to processed/{dest.name}")
    except Exception as e:
        log.error(f"  FAILED: {e}")

def watch():
    log.info(f"Email watcher started. Watching: {WATCH_DIR}")
    log.info(f"Poll interval: {POLL_SECS}s")

    # Connect to table storage once
    try:
        tc = get_table_client()
        log.info("Azure Table Storage connected.")
    except Exception as e:
        log.error(f"Table storage connection failed: {e}")
        sys.exit(1)

    while True:
        try:
            emls = list(WATCH_DIR.glob("*.eml"))
            for path in emls:
                # Skip if file was just written (wait for it to be fully saved)
                age = time.time() - path.stat().st_mtime
                if age < 5:
                    continue
                process_file(tc, path)
        except Exception as e:
            log.error(f"Watch loop error: {e}")
        time.sleep(POLL_SECS)

if __name__ == "__main__":
    if not WATCH_DIR.exists():
        log.error(f"Watch folder does not exist: {WATCH_DIR}")
        log.error("Create it or forward emails there first.")
        sys.exit(1)
    watch()
