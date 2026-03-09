"""
Azure AI Foundry — Claude Opus 4.6 via managed identity.
All data stays inside the ULU Malu Azure tenant. No API keys.
Local dev: az login   Production: system-assigned managed identity
"""
import os
import logging
from typing import List, Dict, Any, Optional

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from azure.ai.inference.models import SystemMessage, UserMessage, AssistantMessage

logger = logging.getLogger(__name__)

DEPLOY = os.environ.get("AZURE_AI_DEPLOYMENT", "claude-opus-4-6")


def _to_sdk_messages(messages: List[Dict[str, Any]]) -> list:
    out = []
    for m in messages:
        role, content = m["role"], m["content"]
        if role == "system":
            out.append(SystemMessage(content=content))
        elif role == "user":
            out.append(UserMessage(content=content))
        elif role == "assistant":
            out.append(AssistantMessage(content=content))
    return out


def chat(
    messages: List[Dict[str, Any]],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4000,
    **kwargs
) -> Dict[str, Any]:
    """
    Send a chat completion request to Claude via Azure AI Foundry.
    messages = [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
    Returns {"content": str, "model": str, "usage": ..., "finish_reason": ...}
    """
    endpoint = os.environ.get("AZURE_AI_PROJECT_ENDPOINT")
    if not endpoint:
        raise ValueError("AZURE_AI_PROJECT_ENDPOINT environment variable is required.")

    deployment = model or DEPLOY

    try:
        credential = DefaultAzureCredential()
        with AIProjectClient(endpoint=endpoint, credential=credential) as project_client:
            with project_client.inference.get_chat_completions_client() as chat_client:
                response = chat_client.complete(
                    messages=_to_sdk_messages(messages),
                    model=deployment,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs
                )
                result = {
                    "content": response.choices[0].message.content if response.choices else "",
                    "model": getattr(response, "model", deployment),
                    "usage": getattr(response, "usage", None),
                    "finish_reason": response.choices[0].finish_reason if response.choices else None,
                }
                logger.info(f"Foundry call OK (model: {result['model']})")
                return result
    except Exception as e:
        logger.error(f"Foundry error: {str(e)}")
        raise


def get_reply(messages: List[Dict[str, Any]], **kwargs) -> str:
    """Convenience: send chat and return just the text reply."""
    return chat(messages, **kwargs)["content"]
