from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition

credential = DefaultAzureCredential()
project_client = AIProjectClient(
    endpoint="https://ai-xgsn7koaekgj6.services.ai.azure.com/api/projects/proj-default",
    credential=credential,
)

guardian = project_client.agents.create_version(
    agent_name="Guardian",
    definition=PromptAgentDefinition(
        model="gpt-4o-mini",
        instructions="You are Guardian — ULU Malu Systems autonomous agentic AI. You triage, prioritize, draft, and escalate autonomously. You are the living nervous system of Ulu Malu.",
    )
)
print(f"✅ GUARDIAN AGENT CREATED")
print(f"Name: {guardian.name}")
print(f"ID: {guardian.id}")
