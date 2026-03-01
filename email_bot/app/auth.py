"""
Authentication Module for ULU Email Bot
Handles API key validation and credential management
"""

import os
from functools import lru_cache
from typing import Optional


def _get_keyvault_url() -> Optional[str]:
    return os.getenv("KEY_VAULT_URL")


@lru_cache(maxsize=1)
def _get_keyvault_client():
    vault_url = _get_keyvault_url()
    if not vault_url:
        return None

    try:
        from azure.identity import DefaultAzureCredential
        from azure.keyvault.secrets import SecretClient
    except Exception:
        return None

    credential = DefaultAzureCredential()
    return SecretClient(vault_url=vault_url, credential=credential)


def _get_keyvault_secret(secret_name: str) -> Optional[str]:
    try:
        client = _get_keyvault_client()
        if client is None:
            return None
        return client.get_secret(secret_name).value
    except Exception:
        return None


def _resolve_secret_name(key_name: str) -> str:
    override_name = os.getenv(f"KEY_VAULT_SECRET_{key_name}")
    return override_name or key_name


def get_api_key(key_name: str) -> Optional[str]:
    """
    Get API key from environment variables
    
    Args:
        key_name: Name of the environment variable
        
    Returns:
        API key if found, None otherwise
    """
    env_value = os.getenv(key_name)
    if env_value:
        return env_value

    # Optional Key Vault fallback when KEY_VAULT_URL is set.
    secret_value = _get_keyvault_secret(_resolve_secret_name(key_name))
    if secret_value:
        os.environ[key_name] = secret_value
        return secret_value

    return None


def validate_xai_api_key() -> bool:
    """
    Validate that the XAI API key is set
    
    Returns:
        True if the key is set, False otherwise
    """
    api_key = get_api_key("XAI_API_KEY")
    return api_key is not None and len(api_key) > 0


def get_credentials() -> dict:
    """
    Get all required credentials for the email bot
    
    Returns:
        Dictionary of credentials
    """
    return {
        "xai_api_key": get_api_key("XAI_API_KEY"),
        # Add other credentials as needed
    }
