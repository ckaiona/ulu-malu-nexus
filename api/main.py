"""NEXUS Kia'i FastAPI backend — ULU Malu Systems Security Operations Platform."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import agents, clients, command, dashboard, events, pentest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="NEXUS Kia'i API",
    description="ULU Malu Systems — Security Operations Platform (Phase 1)",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"

app.include_router(dashboard.router, prefix=PREFIX)
app.include_router(clients.router, prefix=PREFIX)
app.include_router(agents.router, prefix=PREFIX)
app.include_router(events.router, prefix=PREFIX)
app.include_router(pentest.router, prefix=PREFIX)
app.include_router(command.router, prefix=PREFIX)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "nexus-kiai-api", "version": "1.0.0"}


@app.on_event("startup")
async def _startup():
    logger.info("NEXUS Kia'i API started — CORS origins: %s", settings.cors_origins)
