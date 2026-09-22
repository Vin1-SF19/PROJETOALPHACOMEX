#!/usr/bin/env bash
set -euo pipefail
VENV="/home/ialpha/projetos/alpha-comex/painel-alpha/mcp/postgres/.venv"
exec "$VENV/bin/postgres-mcp" \
  "postgresql://temporal:temporal@172.23.0.4:5432/temporal" \
  --access-mode restricted \
  --transport stdio
