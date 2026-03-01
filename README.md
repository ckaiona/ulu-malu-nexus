# ULU Email Processing System

A comprehensive email processing system that organizes, categorizes, and processes emails using AI.

## Components

### 1. EML Organizer (`eml_organizer.py`)

A script that organizes .eml files into a structured directory hierarchy based on:

- Date (year/month)
- Sender
- Optional subject folder
- Optional semantic categorization using Grok API

Key features:

- Preserves source folder structure
- Supports dry-run mode
- Can move or copy files
- Uses Grok for semantic categorization and sentiment analysis
- Handles duplicates and errors with quarantine
- Generates a JSON manifest of processed emails

### 2. Email Bot (`email_bot/`)

A system that processes emails and generates appropriate responses using CrewAI and Grok.

Components:

- `main.py`: Bridges between the processor and CrewAI
- `app/processor.py`: Processes emails and determines actions
- `app/auth.py`: Handles API key validation and credential management

### 3. Agent System (`eml_agent_v4_grok.py`)

Defines a top-level agent "Kumu Grok" using:

- CrewAI framework
- Grok 4.2 Beta as the LLM
- Configuration for orchestrating a swarm of agents

## Usage

### EML Organizer

```bash
# Basic usage (dry run)
python eml_organizer.py input_dir output_dir

# Process emails for real
python eml_organizer.py input_dir output_dir --no-dry-run

# With semantic categorization
export GROK_API_KEY="your_key_here"
python eml_organizer.py input_dir output_dir --no-dry-run --semantic
```

### Email Bot

```bash
# Set the API key
export XAI_API_KEY="your_key_here"

# Or use Azure Key Vault (secret name must be XAI_API_KEY)
export KEY_VAULT_URL="https://your-vault-name.vault.azure.net/"

# Optional: choose a different provider
# LLM_PROVIDER can be: xai, openai, azure-openai, anthropic, gemini
export LLM_PROVIDER="xai"

# Optional: override secret names in Key Vault
# export KEY_VAULT_SECRET_OPENAI_API_KEY="OPENAI-API-KEY"
# export KEY_VAULT_SECRET_AZURE_OPENAI_API_KEY="AZURE-OPENAI-API-KEY"
# export KEY_VAULT_SECRET_ANTHROPIC_API_KEY="ANTHROPIC-API-KEY"
# export KEY_VAULT_SECRET_GOOGLE_API_KEY="GOOGLE-API-KEY"

# Process emails from a manifest
python email_bot/main.py --manifest processed_emails.json --output email_bot_output
```

## Pipeline Flow

1. **Organize**: Use `eml_organizer.py` to organize emails and generate a manifest
2. **Process**: The Email Bot processes the manifest to determine actions
3. **Respond**: CrewAI with Kumu Grok generates appropriate responses

## Development

### Makefile Shortcuts

```bash
# Show available shortcuts
make help

# Install dependencies
make deps

# Install exact locked dependencies
make deps-lock

# Refresh requirements-lock.txt from current environment
make lock

# Check local environment + app endpoint
make doctor

# Extended diagnostics (includes key project files)
make doctor-full

# Run / stop Streamlit app
make run
make stop

# Run tests
make test
```

### Dependency Files

- `requirements.txt`: primary project dependencies (includes key pinned runtime packages).
- `requirements-lock.txt`: exact, fully locked environment snapshot from `pip freeze` for reproducible installs.

Use one of the following:

```bash
# Standard project install
python3.13 -m pip install -r requirements.txt

# Fully reproducible install (exact versions)
python3.13 -m pip install -r requirements-lock.txt
```

To run tests:

```bash
python test_processor.py
```
