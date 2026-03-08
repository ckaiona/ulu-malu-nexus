#!/usr/bin/env python3
"""
push_drafts.py — reads real .eml files, generates AI reply drafts,
saves them to Azure Table Storage so NEXUS Drafts page shows live data.

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python3 push_drafts.py [path/to/eml/folder]

Defaults to ~/Downloads/eml_export/ULU-Malu if no folder given.
"""

import os, sys, email, json, hashlib, datetime
from email.header import decode_header
from email.policy import default as email_policy
from pathlib import Path
from urllib.request import Request, urlopen
from azure.data.tables import TableServiceClient
from kiai_memory import get_memories, save_memory, format_for_prompt

# ── Config ────────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
STORAGE_CONN      = os.environ.get(
    "MEMORY_STORAGE_CONNECTION",
    "DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;"
    "AccountName=ulunexusmemory;"
    "AccountKey=N4NRdg5ThLrtL1V6WxZ8Q9DziVT+6fj+6raiLaA7U1Fue2fKXLUGhYiL4xxyrdxOd3ZFA6jh6Hm0+ASt2n3JNA=="
)
TABLE      = "NexusDrafts"
OWNER      = "caiona@ulumalusystems.com"
EML_FOLDER = sys.argv[1] if len(sys.argv) > 1 else \
             str(Path.home() / "Downloads/eml_export/ULU-Malu")

# ── Helpers ───────────────────────────────────────────────────────────────────
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

def generate_draft(subject, sender, body, client: str = ""):
    if not ANTHROPIC_API_KEY:
        return f"[ANTHROPIC_API_KEY not set] Draft for: {subject}"
    import urllib.request, json as j

    # Load persistent memory for context
    memories = get_memories(client=client, top=20)
    mem_block = format_for_prompt(memories)
    system = (
        "You are Kia'i, the AI assistant for ULU Malu Systems. "
        "Draft a concise, professional email reply on behalf of Camille Aiona. "
        "Be warm, direct, and action-oriented. No timelines or dates. "
        "Reply in plain text only — no markdown."
        + (f"\n\n{mem_block}" if mem_block else "")
    )

    payload = j.dumps({
        "model": "claude-opus-4-6",
        "max_tokens": 512,
        "system": system,
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
        return j.loads(r.read())["content"][0]["text"]

# ── Azure Table Storage (using SDK) ──────────────────────────────────────────
def get_table_client():
    svc = TableServiceClient.from_connection_string(STORAGE_CONN)
    try:
        svc.create_table(TABLE)
    except Exception:
        pass  # already exists
    return svc.get_table_client(TABLE)

def save_draft(tc, draft_id, subject, sender, to, body, draft_body):
    rev  = str(9999999999999 - int(datetime.datetime.utcnow().timestamp() * 1000)).zfill(13)
    rand = hashlib.md5(draft_id.encode()).hexdigest()[:5]
    entity = {
        "PartitionKey": "draft",
        "RowKey": f"{rev}-{rand}",
        "DraftId":      draft_id,
        "OwnerEmail":   OWNER,
        "AddressedTo":  sender,
        "Subject":      f"Re: {subject}",
        "SenderPersona":"Camille Aiona – Lead AI Architect",
        "ClientName":   sender.split("<")[0].strip(),
        "Status":       "Pending",
        "Body":         draft_body,
        "OriginalBody": body[:500],
        "createdAt":    datetime.datetime.utcnow().isoformat(),
    }
    tc.upsert_entity(entity)

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"Connecting to table storage...")
    tc = get_table_client()
    print("Table ready.")

    folder = Path(EML_FOLDER)
    emls   = list(folder.rglob("*.eml"))
    if not emls:
        print(f"No .eml files found in {folder}"); sys.exit(1)

    print(f"Found {len(emls)} emails in {folder}\n")

    saved = 0
    for path in emls[:10]:  # cap at 10 for first run
        try:
            subject, sender, to, body = parse_eml(path)
            draft_id = hashlib.md5(str(path).encode()).hexdigest()[:12]
            print(f"  [{draft_id}] {subject[:60]} — from {sender[:40]}")
            client_name = sender.split("<")[0].strip() or sender
            print(f"    Generating draft...", end=" ", flush=True)
            draft_body = generate_draft(subject, sender, body, client=client_name)
            print("done")
            save_draft(tc, draft_id, subject, sender, to, body, draft_body)
            save_memory(
                f"Drafted reply to '{subject[:80]}' from {client_name}",
                type="draft", client=client_name, page="drafts", importance=3
            )
            saved += 1
        except Exception as e:
            print(f"    ERROR: {e}")

    print(f"\n{saved} drafts saved to Azure Table Storage.")
    print(f"Open NEXUS → Drafts to see them (the page reads from /api/drafts).")
    print(f"\nNOTE: You also need to update /api/drafts to read from NexusDrafts table.")

if __name__ == "__main__":
    main()
