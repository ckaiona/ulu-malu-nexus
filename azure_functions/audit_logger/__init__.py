"""
audit-logger — Azure Function (HTTP Trigger)
POST endpoint called by other functions and Copilot Studio agents
to log actions to the SharePoint AuditLog list.

Body: {
  "action": "DRAFT_CREATED",
  "performed_by": "email-processor",
  "target_entity": "email-id-123",
  "details": "...",
  "agent_name": "KumuGrok"
}
"""
import os
import json
import logging
import azure.functions as func

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.sharepoint_client import write_audit_log

logger = logging.getLogger(__name__)

REQUIRED = {"action", "performed_by", "target_entity", "details", "agent_name"}


def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except Exception:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body"}),
            status_code=400,
            mimetype="application/json"
        )

    missing = REQUIRED - set(body.keys())
    if missing:
        return func.HttpResponse(
            json.dumps({"error": f"Missing fields: {missing}"}),
            status_code=400,
            mimetype="application/json"
        )

    try:
        write_audit_log(
            action=body["action"],
            performed_by=body["performed_by"],
            target_entity=body["target_entity"],
            details=body["details"],
            agent_name=body["agent_name"]
        )
        logger.info(f"Audit log written: {body['action']} by {body['performed_by']}")
        return func.HttpResponse(
            json.dumps({"status": "logged"}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logger.error(f"AuditLog write failed: {e}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
