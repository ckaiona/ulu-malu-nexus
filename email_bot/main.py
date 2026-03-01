#!/usr/bin/env python3
"""
ULU Email Bot Main Module
Bridges between the email processor and CrewAI system
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from crewai import Crew, Task, Process

# Add the parent directory to sys.path to import eml_agent_v4_grok
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from eml_agent_v4_grok import kumu_grok
from app.processor import load_processed_emails, process_email
from app.auth import validate_xai_api_key

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
logger = logging.getLogger("email_bot")

def create_email_task(email_decision):
    """
    Create a CrewAI task for an email
    
    Args:
        email_decision: Decision dictionary from the processor
        
    Returns:
        CrewAI Task
    """
    email_record = email_decision["email_record"]
    
    # Determine task description based on action
    if email_decision["action"] == "draft_reply":
        description = f"Draft a {email_decision['tone']} reply to the email from {email_record['sender']} with subject '{email_record['subject']}'"
    elif email_decision["action"] == "escalate":
        description = f"Analyze this {email_decision['priority']} priority email from {email_record['sender']} with subject '{email_record['subject']}' and provide a detailed summary with recommended actions"
    else:
        description = f"Process this email from {email_record['sender']} with subject '{email_record['subject']}' and provide appropriate next steps"
    
    # Create the task with context as a list
    context_list = [
        f"Sender: {email_record['sender']}",
        f"Subject: {email_record['subject']}",
        f"Category: {email_record['category']}",
        f"Sentiment: {email_record['sentiment']}",
        f"Priority: {email_decision['priority']}",
        f"Action: {email_decision['action']}",
        f"Tone: {email_decision['tone']}"
    ]
    
    # Add optional fields if they exist
    if "path" in email_record:
        context_list.append(f"Email Path: {email_record['path']}")
    if "date" in email_record:
        context_list.append(f"Date: {email_record['date']}")
    
    return Task(
        description=description,
        expected_output=f"Complete response for email: {email_record['subject']}",
        context=context_list
    )

def main():
    """Main entry point for the email bot"""
    parser = argparse.ArgumentParser(description="ULU Email Bot")
    parser.add_argument("--manifest", type=str, required=True, help="Path to the processed_emails.json manifest file")
    parser.add_argument("--output", type=str, default="email_bot_output", help="Output directory for email responses")
    args = parser.parse_args()
    
    # Validate API key
    if not validate_xai_api_key():
        logger.error("XAI_API_KEY environment variable not set or empty")
        return 1
    
    # Create output directory
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Load processed emails
    emails = load_processed_emails(args.manifest)
    if not emails:
        logger.error(f"No emails found in manifest: {args.manifest}")
        return 1
    
    logger.info(f"Loaded {len(emails)} emails from manifest")
    
    # Process emails and create tasks
    tasks = []
    for email in emails:
        # Process email to determine action
        decision = process_email(email)
        
        # Only create tasks for emails that need LLM processing
        if decision["needs_llm"]:
            task = create_email_task(decision)
            tasks.append(task)
            logger.info(f"Created task for email: {email['subject']} (Priority: {decision['priority']}, Action: {decision['action']})")
    
    if not tasks:
        logger.info("No emails require LLM processing")
        return 0
    
    # Create the crew with Kumu Grok as the manager
    crew = Crew(
        agents=[kumu_grok],  # We can add specialist agents later
        tasks=tasks,
        manager_agent=kumu_grok,
        process=Process.hierarchical,
        memory=True,  # Enable memory on the Crew
        verbose=2
    )
    
    # Run the crew
    results = crew.run()
    
    # Save results
    for i, result in enumerate(results):
        output_file = output_dir / f"response_{i}.txt"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(result)
        logger.info(f"Saved response to {output_file}")
    
    logger.info(f"Processed {len(results)} emails")
    return 0

if __name__ == "__main__":
    exit(main())
