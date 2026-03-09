import logging, json
import azure.functions as func

# TODO: import python-pptx and render using template URL from Key Vault

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("generateSlides called")
    body = req.get_json() if req.method == 'POST' else {}
    topic = body.get('topic', 'Executive Update')
    # TODO: Foundry outline -> PPTX render -> upload to SharePoint
    return func.HttpResponse(json.dumps({"status": "queued", "topic": topic}), mimetype="application/json")
