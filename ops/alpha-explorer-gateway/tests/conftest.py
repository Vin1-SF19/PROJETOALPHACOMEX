from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ.update({
    "SMB_GATEWAY_AUDIENCE": "alpha-explorer-smb-gateway",
    "SMB_GATEWAY_PRODUCTION_ORIGIN": "https://painel.alpha-comex.com",
    "SMB_GATEWAY_STAGE_ORIGIN": "https://stagealpha-sistema.alpak.ai",
    "SMB_GATEWAY_ISSUER_PRODUCTION": "alpha-explorer-production",
    "SMB_GATEWAY_ISSUER_STAGE": "alpha-explorer-stage",
    "SMB_GATEWAY_TICKET_KID_PRODUCTION": "prod-key-2026",
    "SMB_GATEWAY_TICKET_KID_STAGE": "stage-key-2026",
    "SMB_GATEWAY_TICKET_SECRET_PRODUCTION": "production-secret-with-more-than-32-bytes",
    "SMB_GATEWAY_TICKET_SECRET_STAGE": "stage-secret-with-more-than-thirty-two-bytes",
    "SMB_GATEWAY_SMB_SERVER": "nas.invalid",
    "SMB_GATEWAY_SMB_SHARES": "ALPHA_TEST,FINANCEIRO_TEST",
    "SMB_GATEWAY_ENVIRONMENT": "test",
    "SMB_GATEWAY_SECRET_STORE": "memory",
    "SMB_GATEWAY_REPLAY_DB_PATH": ":memory:",
    "SMB_GATEWAY_STATE_DB_PATH": ":memory:",
})
