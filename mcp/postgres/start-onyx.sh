#!/usr/bin/env bash
set -euo pipefail
VENV="/home/ialpha/projetos/alpha-comex/painel-alpha/mcp/postgres/.venv"
exec "$VENV/bin/postgres-mcp" \
  "postgresql://postgres:password@172.18.0.3:5432/postgres" \
  --access-mode restricted \
  --transport stdio
