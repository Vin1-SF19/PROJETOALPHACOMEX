#!/usr/bin/env bash
set -euo pipefail
VENV="/home/ialpha/projetos/alpha-comex/painel-alpha/mcp/postgres/.venv"
exec "$VENV/bin/postgres-mcp" \
  "postgresql://rocket:1a5a2e3d9c13f0fed60b0471214ba0a0796f796e56c52865798a24ac0d0ee00d@172.24.0.6:5432/rocket" \
  --access-mode restricted \
  --transport stdio
