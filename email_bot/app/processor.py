"""
Email Processor Module for ULU Email Bot
Handles the logic for processing emails without LLM orchestration
"""

import json
from typing import Dict, Any, List


def load_processed_emails(manifest_path: str) -> List[Dict[str, Any]]:
    """
    Load the processed emails from the manifest file
    
    Args:
        manifest_path: Path to the processed_emails.json file
        
    Returns:
        List of email records
    """
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading manifest: {e}")
        return []


def process_email(email_record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a single email record and determine the appropriate action
    
    Args:
        email_record: A single email record from the manifest
        
    Returns:
        Decision dictionary with action, priority, etc.
    """
    # Extract key information
    category = email_record.get("category", "Uncategorized")
    subject = email_record.get("subject", "")
    sentiment = email_record.get("sentiment", "neutral")
    urgency = email_record.get("urgency", "medium")
    action_needed = email_record.get("action_needed", False)
    
    # Initialize decision with defaults
    decision = {
        "priority": "P3",  # P1 (highest) to P3 (lowest)
        "action": "log",   # log, draft_reply, escalate, ignore
        "tone": "professional",
        "needs_llm": False,
        "email_record": email_record
    }
    
    # Determine priority based on category and urgency
    if category in ["CMMC-Compliance", "Security-Alerts"]:
        decision["priority"] = "P1"
    elif category in ["Trading-Finance", "Invoicing-Tax", "Vendor-MSP"]:
        decision["priority"] = "P2"
    
    # Override priority based on urgency
    if urgency == "high":
        decision["priority"] = "P1"
    
    # Determine action based on category, sentiment, and action_needed
    if category in ["CMMC-Compliance", "Security-Alerts", "Trading-Finance"]:
        decision["action"] = "escalate"
        decision["needs_llm"] = True
    elif action_needed:
        decision["action"] = "draft_reply"
        decision["needs_llm"] = True
    elif sentiment == "negative":
        decision["action"] = "draft_reply"
        decision["needs_llm"] = True
    
    # Determine tone based on category and sentiment
    if category in ["Personal", "ULU-Malu", "ULU-HiTech"]:
        decision["tone"] = "friendly"
    elif sentiment == "negative":
        decision["tone"] = "empathetic"
    
    return decision


def batch_process_emails(manifest_path: str) -> List[Dict[str, Any]]:
    """
    Process all emails in the manifest
    
    Args:
        manifest_path: Path to the processed_emails.json file
        
    Returns:
        List of decision dictionaries
    """
    emails = load_processed_emails(manifest_path)
    decisions = []
    
    for email in emails:
        decision = process_email(email)
        decisions.append(decision)
    
    # Sort by priority
    return sorted(decisions, key=lambda x: x["priority"])
