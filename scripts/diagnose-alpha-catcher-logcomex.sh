#!/usr/bin/env bash
set -Eeuo pipefail
source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node=/home/ialpha/.config/nvm/versions/node/v22.22.3/bin/node
[[ $(id -u) == 0 ]] || { echo 'Execute com sudo para ler a sessão privada como usuário do serviço.' >&2; exit 1; }
cd "$source_root"
exec runuser -u ialpha -- "$node" --import "$source_root/node_modules/tsx/dist/loader.mjs" "$source_root/scripts/diagnose-alpha-catcher-logcomex.mjs" "$@"
