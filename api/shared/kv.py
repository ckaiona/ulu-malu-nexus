import os
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

_cred = DefaultAzureCredential()

class KV:
    def __init__(self):
        name = os.environ.get("KEYVAULT_NAME")
        if not name:
            raise RuntimeError("KEYVAULT_NAME env not set")
        self.client = SecretClient(vault_url=f"https://{name}.vault.azure.net/", credential=_cred)

    def get(self, name: str):
        return self.client.get_secret(name).value
