#!/usr/bin/env bash
set -Eeuo pipefail
root=/home/ialpha/deployments/alpha-catcher-worker-prod
unit=/etc/systemd/system/alpha-catcher-worker-prod.service
proxy=/etc/nginx/conf.d/alpha-catcher-worker-prod.conf
config=/home/ialpha/.config/painel-alpha/alpha-catcher-worker-prod.env
node=/home/ialpha/.config/nvm/versions/node/v22.22.3/bin/node
script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
fail() { echo "$*" >&2; exit 1; }
[[ $(id -u) == 0 ]] || fail 'Execute com sudo.'
exec 9>/run/lock/alpha-catcher-worker-prod-install.lock
flock -n 9 || fail 'Outra instalação está em andamento.'
[[ ! -d /tmp/painel-alpha-logcomex-login.lock ]] || fail 'Aguarde a coleta Logcomex terminar.'
[[ -f "$root/installed" && -f "$root/service.failed" && -f "$root/proxy.failed" && -f "$config" ]] || fail 'Arquivos da instalação interrompida ausentes.'
[[ ! -e "$unit" && ! -L "$unit" && ! -e "$proxy" && ! -L "$proxy" ]] || fail 'Configuração existente: retomada bloqueada.'
release="$(readlink -f "$root/current")"
[[ "$release" == "$root/releases/"* && -s "$release/.next/BUILD_ID" ]] || fail 'Release privada inválida.'
count=0
seen_unit=false
seen_proxy=false
while read -r expected saved_path; do
  case "$saved_path" in
    "$unit") [[ "$seen_unit" == false ]] || fail 'Unit duplicada no inventário.'; seen_unit=true; file="$root/service.failed" ;;
    "$proxy") [[ "$seen_proxy" == false ]] || fail 'Proxy duplicado no inventário.'; seen_proxy=true; file="$root/proxy.failed" ;;
    *) fail 'Inventário inesperado.' ;;
  esac
  [[ ! -L "$file" && "$(sha256sum "$file" | cut -d ' ' -f1)" == "$expected" ]] || fail 'Configuração preservada foi modificada.'
  count=$((count + 1))
done < "$root/installed"
[[ "$count" == 2 && "$seen_unit" == true && "$seen_proxy" == true ]] || fail 'Inventário incompleto.'
for port in 3301 3302; do
  sockets="$(ss -ltnH "sport = :$port" 2>&1)"
  [[ -z "$sockets" ]] || fail "Porta $port ocupada ou indisponível para inspeção."
done
nginx -t
unit_restored=false
proxy_restored=false
finish() {
  local result=$?
  trap - EXIT
  if [[ "$result" != 0 ]]; then
    if [[ "$unit_restored" == true ]]; then
      systemctl disable --now alpha-catcher-worker-prod.service || true
      mv "$unit" "$root/service.failed" || true
      systemctl daemon-reload || true
    fi
    if [[ "$proxy_restored" == true ]]; then
      mv "$proxy" "$root/proxy.failed" || true
      if nginx -t; then systemctl reload nginx || true; fi
    fi
    echo 'Retomada falhou; worker desativado e arquivos preservados.' >&2
  fi
  exit "$result"
}
trap finish EXIT
mv "$root/service.failed" "$unit"
unit_restored=true
mv "$root/proxy.failed" "$proxy"
proxy_restored=true
sha256sum -c "$root/installed"
nginx -t
systemctl daemon-reload
systemctl enable --now alpha-catcher-worker-prod.service
systemctl reload nginx
ready=false
for _ in {1..45}; do
  code="$(curl -s --max-time 2 -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3302/api/internal/alpha-catcher/worker -H 'Content-Type: application/json' -d '{}' || true)"
  if [[ "$code" == 401 ]]; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || fail 'Proxy/worker não ficou disponível; confira logs do nginx e worker com sudo.'
[[ $(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:3302/) == 404 ]] || fail 'Isolamento do proxy falhou.'
"$node" "$script_dir/alpha-catcher-worker-prod/smoke.mjs" "$config"
echo 'Worker retomado e testes locais aprovados. DNS/Tunnel e Vercel ainda pendentes.'
