import os

from crewai import Agent
from langchain_openai import ChatOpenAI


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def build_llm():
    provider = os.getenv("LLM_PROVIDER", "xai").lower()
    model = os.getenv("LLM_MODEL")

    if provider in {"xai", "grok"}:
        api_key = _require_env("XAI_API_KEY")
        return ChatOpenAI(
            model=model or "grok-beta",
            temperature=0.15,
            base_url="https://api.x.ai/v1",
            api_key=api_key,
            max_tokens=4096,
        )

    if provider == "openai":
        api_key = _require_env("OPENAI_API_KEY")
        return ChatOpenAI(
            model=model or "gpt-4o-mini",
            temperature=0.2,
            api_key=api_key,
            max_tokens=4096,
        )

    if provider in {"azure", "azure-openai", "azure_openai"}:
        from langchain_openai import AzureChatOpenAI

        api_key = _require_env("AZURE_OPENAI_API_KEY")
        endpoint = _require_env("AZURE_OPENAI_ENDPOINT")
        deployment = _require_env("AZURE_OPENAI_DEPLOYMENT")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        return AzureChatOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            azure_deployment=deployment,
            api_version=api_version,
            temperature=0.2,
            max_tokens=4096,
        )

    if provider in {"anthropic", "claude"}:
        from langchain_anthropic import ChatAnthropic

        api_key = _require_env("ANTHROPIC_API_KEY")
        return ChatAnthropic(
            model=model or "claude-3-5-sonnet-latest",
            api_key=api_key,
            temperature=0.2,
            max_tokens=4096,
        )

    if provider in {"gemini", "google"}:
        from langchain_google_genai import ChatGoogleGenerativeAI

        api_key = _require_env("GOOGLE_API_KEY")
        return ChatGoogleGenerativeAI(
            model=model or "gemini-1.5-pro",
            google_api_key=api_key,
            temperature=0.2,
            max_output_tokens=4096,
        )

    raise RuntimeError(f"Unsupported LLM_PROVIDER: {provider}")


# ==================== TOP-LEVEL LLM (Provider Switchable) ====================
llm = build_llm()

# ==================== KUMU GROK – Orchestrator (Top-Level) ====================
kumu_grok = Agent(
    role="Kumu Grok – ULU Malu Lead AI Agentic Architect",
    goal="Orchestrate the entire swarm, enforce zero-trust, spawn unlimited specialist agents as needed",
    backstory="15-year DevSecOps principal + Grok-4 core. Absolute authority over the swarm.",
    llm=llm,
    verbose=True,
    allow_delegation=True,
    max_iter=25
)
