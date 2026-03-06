"""
Microsoft Graph client — per-user delegated access via stored refresh tokens.

Auth flow:
  1. User signs into NEXUS via MSAL (frontend)
  2. Frontend POSTs their refresh_token to /api/auth/register-token
  3. That function stores it in Key Vault as secret: refresh-token-{user_email}
  4. This module retrieves + exchanges the token to act as that specific user
  5. All Graph calls use /me/ endpoints — no hardcoded user IDs
"""
import os
import json
import urllib.request
import urllib.parse
import logging

logger = logging.getLogger(__name__)

TENANT_ID   = os.getenv("SHAREPOINT_TENANT_ID")
CLIENT_ID   = os.getenv("SHAREPOINT_CLIENT_ID")
CLIENT_SECRET = os.getenv("SHAREPOINT_CLIENT_SECRET")
KEYVAULT_URL  = os.getenv("KEYVAULT_URL")  # e.g. https://kv-ulu-prod-001.vault.azure.net


# ── Key Vault helpers ────────────────────────────────────────────────────────

def _kv_token() -> str:
    """Get a Key Vault access token using client credentials."""
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    body = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://vault.azure.net/.default",
        "grant_type": "client_credentials"
    }).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())["access_token"]


def get_user_refresh_token(user_email: str) -> str | None:
    """Retrieve a user's refresh token from Key Vault."""
    secret_name = f"refresh-token-{user_email.replace('@', '-at-').replace('.', '-')}"
    url = f"{KEYVAULT_URL}/secrets/{secret_name}?api-version=7.4"
    kv_tok = _kv_token()
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {kv_tok}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())["value"]
    except Exception as e:
        logger.warning(f"No refresh token in KV for {user_email}: {e}")
        return None


def store_user_refresh_token(user_email: str, refresh_token: str) -> None:
    """Store (or update) a user's refresh token in Key Vault."""
    secret_name = f"refresh-token-{user_email.replace('@', '-at-').replace('.', '-')}"
    url = f"{KEYVAULT_URL}/secrets/{secret_name}?api-version=7.4"
    kv_tok = _kv_token()
    body = json.dumps({"value": refresh_token}).encode()
    req = urllib.request.Request(
        url, data=body, method="PUT",
        headers={"Authorization": f"Bearer {kv_tok}", "Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp.read()


# ── Per-user delegated token ─────────────────────────────────────────────────

def get_delegated_token(user_email: str) -> tuple[str, str] | None:
    """
    Exchange a stored refresh token for a fresh access token.
    Returns (access_token, new_refresh_token) or None if token is missing/expired.
    The new refresh token is automatically saved back to Key Vault.
    """
    refresh_token = get_user_refresh_token(user_email)
    if not refresh_token:
        return None

    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    body = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "scope": "https://graph.microsoft.com/Mail.ReadWrite offline_access"
    }).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            new_refresh = data.get("refresh_token", refresh_token)
            store_user_refresh_token(user_email, new_refresh)
            return data["access_token"], new_refresh
    except Exception as e:
        logger.error(f"Token refresh failed for {user_email}: {e}")
        return None


# ── Graph helpers ────────────────────────────────────────────────────────────

def _graph_get(url: str, token: str) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def get_current_user(token: str) -> dict:
    """Returns the /me profile — confirms whose identity the token belongs to."""
    return _graph_get("https://graph.microsoft.com/v1.0/me?$select=id,mail,displayName", token)


# ── Per-user email fetch ─────────────────────────────────────────────────────

def fetch_new_emails_for_user(user_email: str) -> tuple[list[dict], str | None]:
    """
    Fetch unread emails from the authenticated user's own inbox (/me/messages).
    Uses delta sync so only new messages are returned on subsequent calls.
    Delta token is keyed per user so each mailbox is tracked independently.

    Returns: (emails, user_display_name) or ([], None) if token unavailable.
    """
    token_result = get_delegated_token(user_email)
    if not token_result:
        logger.warning(f"Skipping {user_email} — no valid token")
        return [], None

    access_token, _ = token_result

    # Confirm identity — /me resolves to whoever owns the token
    try:
        me = get_current_user(access_token)
        display_name = me.get("displayName", user_email)
        resolved_email = me.get("mail", user_email)
        logger.info(f"Processing inbox for: {display_name} <{resolved_email}>")
    except Exception as e:
        logger.error(f"Could not resolve /me for {user_email}: {e}")
        return [], None

    # Per-user delta token stored in /tmp keyed by email
    delta_path = f"/tmp/delta_{user_email.replace('@','_').replace('.','_')}.json"
    try:
        with open(delta_path) as f:
            delta_url = json.load(f).get("deltaLink")
    except FileNotFoundError:
        delta_url = None

    url = delta_url or (
        "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta"
        "?$select=id,subject,from,receivedDateTime,body,isRead"
        "&$filter=isRead eq false"
    )

    emails = []
    while url:
        try:
            data = _graph_get(url, access_token)
        except Exception as e:
            logger.error(f"Graph delta fetch failed for {user_email}: {e}")
            break

        emails.extend(data.get("value", []))
        url = data.get("@odata.nextLink")
        if "@odata.deltaLink" in data:
            with open(delta_path, "w") as f:
                json.dump({"deltaLink": data["@odata.deltaLink"]}, f)
            break

    return emails, display_name
