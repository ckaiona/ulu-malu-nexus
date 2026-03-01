from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

# Uses your active az login session
credential = DefaultAzureCredential()

client = SecretClient(
    vault_url="https://ulu-malu-kv.vault.azure.net/",
    credential=credential,
)

secret = client.get_secret("XAI-API-KEY").value
print(secret)
