from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/nexus"

    # Azure AD
    azure_tenant_id: str = "dd59f285-3eee-4150-8bfa-91bd8a96a83b"
    azure_client_id: str = "d66cf553-c981-415b-8e49-55792547a917"

    # Guardian AI
    guardian_endpoint: str = "https://ai-xgsn7koaekgj6.services.ai.azure.com/api/projects/proj-default"
    guardian_api_key: str = ""

    # CORS origins (JSON-encoded list or comma-separated)
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
    ]

    # App
    debug: bool = False
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
