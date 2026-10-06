#!/usr/bin/env bash
set -Eeuo pipefail

# Ativa apenas o candidato pré-buildado desta entrega; não altera o banco.
source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
candidate="$source_root/tmp/alpha-catcher-stage-candidate"
deploy_root=/home/ialpha/deployments/painel-alpha-stage
service=painel-alpha-stage.service
node=/home/ialpha/.config/nvm/versions/node/v22.22.3/bin/node
expected_build=zRGxCxf8vHCjxk-PFbNv2
[[ $(id -u) == 0 ]] || { echo 'Execute este script com sudo.' >&2; exit 1; }
[[ $(cat "$candidate/.next/BUILD_ID") == "$expected_build" ]] || { echo 'Build do candidato divergente.' >&2; exit 1; }
[[ $(systemctl show "$service" --property=WorkingDirectory --value) == "$deploy_root/current" ]] || exit 1
"$node" -e 'const fs=require("fs");const m=JSON.parse(fs.readFileSync(process.argv[1]));if(!m["/api/alpha-catcher/logcomex/route"])process.exit(1)' "$candidate/.next/server/app-paths-manifest.json"
exec 9>"$deploy_root/deploy.lock"
flock -n 9 || { echo 'Outro deploy está em andamento.' >&2; exit 1; }
previous="$(readlink -f "$deploy_root/current")"
release="$deploy_root/releases/$(date -u +%Y%m%d-%H%M%S)-alpha-catcher"
mkdir "$release"
rsync -a "$candidate/" "$release/"
chown -R ialpha:ialpha "$release"
for env_file in .env .env.local .env.production .env.production.local; do
  [[ ! -f "$release/$env_file" ]] || chmod 600 "$release/$env_file"
done
activated=false
smoke_pid=''
cleanup() {
  [[ -z "$smoke_pid" ]] || kill -TERM -- "-$smoke_pid" 2>/dev/null || true
}
rollback() {
  local result=$?
  trap - ERR
  if [[ "$activated" == true ]]; then
    ln -s "$previous" "$deploy_root/.rollback-alpha-catcher-$$"
    mv -Tf "$deploy_root/.rollback-alpha-catcher-$$" "$deploy_root/current"
    systemctl restart "$service" || true
    echo "Rollback: $previous" >&2
  fi
  exit "$result"
}
trap cleanup EXIT
trap rollback ERR
port=3315
if [[ -n "$(ss -ltnH "sport = :$port")" ]]; then echo 'Porta de validação ocupada.' >&2; exit 1; fi
setsid runuser -u ialpha -- bash -c 'cd "$1"; exec "$2" node_modules/next/dist/bin/next start -p "$3"' bash "$release" "$node" "$port" > "$release/stage-smoke.log" 2>&1 9>&- &
smoke_pid=$!
ready=false
for _ in {1..30}; do
  if curl -fs --max-time 3 -o /dev/null "http://127.0.0.1:$port/"; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
[[ $(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$port/api/alpha-catcher/logcomex" -H 'Content-Type: application/json' -d '{}') == 401 ]]
cleanup
wait "$smoke_pid" 2>/dev/null || true
smoke_pid=''
ln -s "$release" "$deploy_root/.current-alpha-catcher-$$"
mv -Tf "$deploy_root/.current-alpha-catcher-$$" "$deploy_root/current"
activated=true
systemctl restart "$service"
ready=false
for _ in {1..30}; do
  if systemctl is-active --quiet "$service" && curl -fs --max-time 3 -o /dev/null http://127.0.0.1:3300/; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
[[ $(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3300/api/alpha-catcher/logcomex -H 'Content-Type: application/json' -d '{}') == 401 ]]
activated=false
echo "Release publicada: $release"
echo "Build: $expected_build"
echo 'Acesse https://stagepainel-alpha.alpak.ai/PainelAlpha/AlphaCatcher'
