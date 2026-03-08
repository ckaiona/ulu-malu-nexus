"""
kiai_memory.py — shared persistent memory for all ULU scripts.

Reads/writes from Azure Table Storage KiaiMemories — the same table used by
/api/memory and /api/kiai-memory-chat, so memory is shared across the web app,
the email watcher daemon, the batch drafter, and the brain sync.

Usage:
    from kiai_memory import get_memories, save_memory, format_for_prompt

    # Before drafting — inject past context
    mems = get_memories(client="ACME Corp")
    context_block = format_for_prompt(mems)

    # After an action — record it
    save_memory("Drafted reply to ACME re: SOC-2 audit scope", type="draft", client="ACME Corp")
"""

import os
import hashlib
import datetime
import logging

from azure.data.tables import TableServiceClient

TABLE     = "KiaiMemories"
PARTITION = "memory"
log       = logging.getLogger("kiai_memory")

# Connection string — prefer env var, fall back to hardcoded for local dev.
# IMPORTANT: rotate the storage key and store it in Azure Key Vault / .env only.
_STORAGE_CONN = os.environ.get("MEMORY_STORAGE_CONNECTION") or (
    "DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;"
    "AccountName=ulunexusmemory;"
    "AccountKey=N4NRdg5ThLrtL1V6WxZ8Q9DziVT+6fj+6raiLaA7U1Fue2fKXLUGhYiL4xxyrdxOd3ZFA6jh6Hm0+ASt2n3JNA=="
)


def _table_client():
    svc = TableServiceClient.from_connection_string(_STORAGE_CONN)
    try:
        svc.create_table(TABLE)
    except Exception:
        pass  # table already exists
    return svc.get_table_client(TABLE)


def get_memories(client: str = "", top: int = 25) -> list:
    """Return recent KiaiMemories, optionally filtered by client name."""
    try:
        tc   = _table_client()
        filt = f"PartitionKey eq '{PARTITION}'"
        if client:
            safe = client.replace("'", "''")
            filt += f" and client eq '{safe}'"
        return list(tc.query_entities(filt, results_per_page=top))[:top]
    except Exception as e:
        log.warning(f"kiai_memory.get_memories failed: {e}")
        return []


def save_memory(summary: str, type: str = "general", client: str = "",
                page: str = "", importance: int = 3) -> bool:
    """Save a memory entry to KiaiMemories (non-fatal on failure)."""
    try:
        tc   = _table_client()
        rev  = str(9999999999999 - int(datetime.datetime.utcnow().timestamp() * 1000)).zfill(13)
        rand = hashlib.md5(summary[:50].encode()).hexdigest()[:5]
        tc.upsert_entity({
            "PartitionKey": PARTITION,
            "RowKey":       f"{rev}-{rand}",
            "summary":      summary[:500],
            "type":         type,
            "client":       client,
            "page":         page,
            "importance":   importance,
            "createdAt":    datetime.datetime.utcnow().isoformat(),
        })
        log.info(f"kiai_memory saved [{type}] {summary[:70]}")
        return True
    except Exception as e:
        log.warning(f"kiai_memory.save_memory failed: {e}")
        return False


def format_for_prompt(memories: list) -> str:
    """Format a memory list for injection into an AI system prompt."""
    if not memories:
        return ""
    lines = []
    for m in memories:
        date   = str(m.get("createdAt", ""))[:10]
        client = m.get("client", "")
        text   = m.get("summary", "")
        tag    = f"[{date}]" + (f" [{client}]" if client else "")
        lines.append(f"• {tag} {text}")
    return (
        f"PERSISTENT MEMORY — {len(memories)} past entries recalled:\n"
        + "\n".join(lines)
        + "\n\nUse this context proactively when drafting your reply."
    )
