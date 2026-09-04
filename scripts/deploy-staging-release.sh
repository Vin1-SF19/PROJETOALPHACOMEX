#!/usr/bin/env bash
set -Eeuo pipefail

source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
deploy_root="${PAINEL_ALPHA_STAGE_ROOT:-/home/ialpha/deployments/painel-alpha-stage}"
service_name="${PAINEL_ALPHA_STAGE_SERVICE:-painel-alpha-stage.service}"
current_link="$deploy_root/current"
releases_root="$deploy_root/releases"
service_template="$source_root/ops/systemd/painel-alpha-stage.service"
health_url="${PAINEL_ALPHA_STAGE_HEALTH_URL:-http://127.0.0.1:3300/}"

mkdir -p "$releases_root"
exec 9>"$deploy_root/deploy.lock"
flock 9

old_working_directory="$(systemctl show "$service_name" --property=WorkingDirectory --value 2>/dev/null || true)"
old_release="$(readlink -f "$current_link" 2>/dev/null || true)"
if [[ -z "$old_release" && -d "$old_working_directory" ]]; then
  old_release="$old_working_directory"
fi

echo "[stage] Buildando o workspace..."
(
  cd "$source_root"
  NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}" npm run build
)

release_id="$(date -u +%Y%m%d-%H%M%S)"
release_path="$releases_root/$release_id"
if [[ -e "$release_path" ]]; then
  release_path="$releases_root/${release_id}-$$"
fi
mkdir "$release_path"

echo "[stage] Criando release isolada $release_path..."
rsync -a \
  --exclude='.git/' \
  --exclude='.next/' \
  --exclude='node_modules/' \
  --exclude='.central-roadmap-production/' \
  --exclude='database-backups/' \
  --exclude='logs/' \
  --exclude='tmp/' \
  --exclude='.tmp/' \
  --exclude='backup_*' \
  --exclude='tsconfig.tsbuildinfo' \
  "$source_root/" "$release_path/"
cp -al "$source_root/node_modules" "$release_path/node_modules"
rsync -a "$source_root/.next/" "$release_path/.next/"

smoke_port=""
for candidate in 3310 3311 3312 3313 3314 3315; do
  if ! ss -ltnH "sport = :$candidate" | grep -q LISTEN; then
    smoke_port="$candidate"
    break
  fi
done
if [[ -z "$smoke_port" ]]; then
  echo "[stage] Nenhuma porta disponível para o smoke test." >&2
  exit 1
fi

smoke_log="$release_path/stage-smoke.log"
smoke_pid=""
smoke_pgid=""
activated=false
# "next start" não é o processo final: ele reexecuta/spawna um next-server
# real por baixo, então matar só $smoke_pid (o líder do subshell em si)
# deixava esse processo neto órfão e vivo, com o fd 9 (lockfile de
# deploy.lock) aberto para sempre — travando todo deploy seguinte
# indefinidamente. Foi exatamente o que aconteceu por ~22h a partir de
# 2026-09-02 19:39 até ser encontrado e corrigido em 2026-09-03. O job é
# backgrounded com "set -m" (job control) só nesse trecho para ganhar um
# PGID próprio, separado do PGID deste script — sem isso, um job em
# background herda o MESMO PGID do script (confirmado empiricamente), e
# matar "-$PGID" mataria o próprio script no meio da limpeza.
cleanup_smoke() {
  # O shell intermediário pode encerrar antes do next-server filho. Por isso o
  # PGID é capturado logo após o spawn e encerrado mesmo se $smoke_pid já sumiu.
  if [[ -n "$smoke_pgid" ]]; then
    kill -TERM -- "-$smoke_pgid" 2>/dev/null || true
  fi
  if [[ -n "$smoke_pid" ]]; then
    kill -TERM "$smoke_pid" 2>/dev/null || true
    wait "$smoke_pid" 2>/dev/null || true
  fi
  smoke_pid=""
  smoke_pgid=""
}
trap cleanup_smoke EXIT

rollback_on_error() {
  local exit_code=$?
  trap - ERR
  if [[ "$activated" == true && -n "$old_release" && -d "$old_release" ]]; then
    echo "[stage] Falha após a ativação; restaurando $old_release." >&2
    rollback_link="$deploy_root/.rollback-$release_id"
    ln -s "$old_release" "$rollback_link"
    mv -Tf "$rollback_link" "$current_link"
    sudo systemctl restart "$service_name" || true
  fi
  exit "$exit_code"
}
trap rollback_on_error ERR

echo "[stage] Validando a release na porta $smoke_port..."
set -m
(
  cd "$release_path"
  NODE_ENV=production ./node_modules/.bin/next start -p "$smoke_port"
) >"$smoke_log" 2>&1 &
smoke_pid=$!
smoke_pgid="$(ps -o pgid= -p "$smoke_pid" 2>/dev/null | tr -d ' ')"
smoke_pgid="${smoke_pgid:-$smoke_pid}"
set +m

smoke_ok=false
for _attempt in $(seq 1 30); do
  if curl -sS -o /dev/null --max-time 3 "http://127.0.0.1:$smoke_port/" \
    && curl -sS -o /dev/null --max-time 3 "http://127.0.0.1:$smoke_port/PainelAlpha/AlphaCRM/automacoes"; then
    smoke_ok=true
    break
  fi
  if ! kill -0 "$smoke_pid" 2>/dev/null; then
    break
  fi
  sleep 1
done
if [[ "$smoke_ok" != true ]]; then
  echo "[stage] Smoke test falhou. Consulte $smoke_log." >&2
  exit 1
fi
cleanup_smoke
smoke_pid=""

next_link="$deploy_root/.current-$release_id"
ln -s "$release_path" "$next_link"
mv -Tf "$next_link" "$current_link"
activated=true

sudo install -m 0644 "$service_template" "/etc/systemd/system/$service_name"
sudo systemctl daemon-reload
sudo systemctl restart "$service_name"

deployed=false
for _attempt in $(seq 1 30); do
  if systemctl is-active --quiet "$service_name" \
    && curl -sS -o /dev/null --max-time 3 "$health_url"; then
    deployed=true
    break
  fi
  sleep 1
done

if [[ "$deployed" != true ]]; then
  echo "[stage] Nova release não respondeu; executando rollback." >&2
  if [[ -n "$old_release" && -d "$old_release" ]]; then
    rollback_link="$deploy_root/.rollback-$release_id"
    ln -s "$old_release" "$rollback_link"
    mv -Tf "$rollback_link" "$current_link"
    sudo systemctl restart "$service_name"
  fi
  activated=false
  exit 1
fi

activated=false
trap - ERR
trap - EXIT
echo "[stage] Deploy concluído."
echo "[stage] Release: $release_path"
echo "[stage] Build ID: $(cat "$release_path/.next/BUILD_ID")"
