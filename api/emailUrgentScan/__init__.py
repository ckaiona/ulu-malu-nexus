import logging, os
import azure.functions as func
from ..shared.kv import KV
from ..shared.foundry import chat

# Placeholder urgent rules; will be loaded from config/urgency.json
VIP_SENDERS = {"gregory.hester@ul...", "russ.stinehour@ul..."}
DOMAINS = {"mauiland.com", "terruyabrothers.com"}
KEYWORDS = {"urgent", "asap", "deadline"}

def main(mytimer: func.TimerRequest) -> None:
    logging.info("emailUrgentScan tick")
    # TODO: Graph delta query for Eric's mailbox
    # TODO: classify per rules; draft via Foundry chat()
    pass
