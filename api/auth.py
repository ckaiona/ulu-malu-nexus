"""JWT validation for MSAL tokens issued by Azure AD."""
import logging
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

bearer_scheme = HTTPBearer(auto_error=False)

JWKS_URL = (
    f"https://login.microsoftonline.com/{settings.azure_tenant_id}/discovery/v2.0/keys"
)
ISSUER = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/v2.0"

# Simple in-process JWKS cache (reset on restart)
_jwks_cache: Optional[dict] = None


async def _get_jwks() -> dict:
    global _jwks_cache
    if not _jwks_cache:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(JWKS_URL)
            r.raise_for_status()
            _jwks_cache = r.json()
    return _jwks_cache


async def verify_token(token: str) -> dict:
    """Validate an Azure AD JWT. Accepts both API-scope and Graph-scope tokens."""
    # 1. Fetch JWKS and find matching key
    try:
        header = jwt.get_unverified_header(token)
        jwks = await _get_jwks()
        key = next(
            (k for k in jwks["keys"] if k.get("kid") == header.get("kid")),
            None,
        )
        if not key:
            raise HTTPException(status_code=401, detail="Token signing key not found")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Key fetch failed: {exc}") from exc

    # 2. Try strict validation (token issued specifically for our API)
    try:
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.azure_client_id,
            issuer=ISSUER,
            options={"verify_at_hash": False},
        )
    except JWTError:
        pass

    # 3. Fall back: accept any valid Azure AD token from our tenant
    #    (covers Graph tokens used during local dev)
    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options={"verify_aud": False, "verify_at_hash": False},
        )
        if claims.get("tid") != settings.azure_tenant_id:
            raise HTTPException(status_code=401, detail="Token issued by wrong tenant")
        return claims
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=401, detail=f"Token validation failed: {exc}"
        ) from exc


# ─── Token data ───────────────────────────────────────────────────────────────

class TokenData:
    def __init__(self, claims: dict):
        self.user_id: str = claims.get("oid") or claims.get("sub", "")
        self.email: str = (
            claims.get("upn")
            or claims.get("preferred_username")
            or claims.get("email", "")
        )
        self.name: str = claims.get("name", "")
        self.roles: list[str] = claims.get("roles", [])
        self.tenant_id: str = claims.get("tid", "")
        self.claims: dict = claims

    def has_role(self, role: str) -> bool:
        return "admin" in self.roles or role in self.roles

    def __repr__(self) -> str:
        return f"<TokenData email={self.email} roles={self.roles}>"


# ─── FastAPI dependencies ─────────────────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> Optional[TokenData]:
    """Returns TokenData if a valid bearer token is provided, else None."""
    if not credentials:
        return None
    try:
        claims = await verify_token(credentials.credentials)
        return TokenData(claims)
    except HTTPException:
        return None


async def require_auth(
    user: Optional[TokenData] = Depends(get_current_user),
) -> TokenData:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(role: str):
    """Dependency factory: enforces that the user has the given role (or admin)."""
    async def checker(user: TokenData = Depends(require_auth)) -> TokenData:
        if not user.has_role(role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' required",
            )
        return user
    return checker
