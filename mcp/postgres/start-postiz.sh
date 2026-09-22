#!/usr/bin/env bash
set -euo pipefail
VENV="/home/ialpha/projetos/alpha-comex/painel-alpha/mcp/postgres/.venv"
exec "$VENV/bin/postgres-mcp" \
  "postgresql://postiz-user:postiz-password@172.22.0.3:5432/postiz-db-local" \
  --access-mode restricted \
  --transport stdio
