#!/usr/bin/env bash
set -euo pipefail
VENV="/home/ialpha/projetos/alpha-comex/painel-alpha/mcp/postgres/.venv"
exec "$VENV/bin/postgres-mcp" \
  "postgresql://chatbotx:secretkey@172.25.0.4:5432/gc_importflow" \
  --access-mode restricted \
  --transport stdio
