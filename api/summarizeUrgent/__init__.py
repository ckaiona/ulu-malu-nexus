import logging
import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("summarizeUrgent called")
    # TODO: Fetch urgent list with links to Eric's Drafts
    return func.HttpResponse("[]", mimetype="application/json")
