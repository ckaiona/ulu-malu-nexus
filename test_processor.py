#!/usr/bin/env python3
"""
Test script for the email processor module
"""

import json
from email_bot.app.processor import load_processed_emails, process_email

# Create a sample processed_emails.json file for testing
sample_email = {
    "path": "test_output/2024/02/test@example.com/sample.eml",
    "sender": "test@example.com",
    "subject": "Hello",
    "category": "ULU-HiTech",
    "date": "2024-02-21T10:00:00-08:00",
    "sentiment": "neutral",
    "urgency": "medium",
    "action_needed": True,
    "summary": "A test email"
}

# Write the sample email to a file
with open("processed_emails.json", "w", encoding="utf-8") as f:
    json.dump([sample_email], f, indent=2)

# Load the emails from the file
emails = load_processed_emails("processed_emails.json")
print(f"Loaded {len(emails)} emails from manifest\n")

# Process the email
for email in emails:
    decision = process_email(email)
    
    print("Email Decision:")
    print(f"  Subject: {email['subject']}")
    print(f"  From: {email['sender']}")
    print(f"  Category: {email['category']}")
    print(f"  Action: {decision['action']}")
    print(f"  Priority: {decision['priority']}")
    print(f"  Tone: {decision['tone']}")
    print(f"  Needs LLM: {decision['needs_llm']}")

def test_email_processing():
    decision = process_email(sample_email)
    assert decision["action"] == "draft_reply"
    assert decision["priority"] == "P3"
    assert decision["needs_llm"] == True
    print("✓ All assertions passed")
