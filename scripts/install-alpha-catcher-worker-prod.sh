#!/usr/bin/env bash
set -Eeuo pipefail
mode="${1:-plan}"
root=/home/ialpha/deployments/alpha-catcher-worker-prod
source=/home/ialpha/deployments/painel-alpha-stage/releases/20261009-130924-alpha-catcher-logcomex-worker
candidate=/var/tmp/painel-alpha-logcomex-worker-candidate
node=/home/ialpha/.config/nvm/versions/node/v22.22.3/bin/node
config=/home/ialpha/.config/painel-alpha/alpha-catcher-worker-prod.env
unit=/etc/systemd/system/alpha-catcher-worker-prod.service
proxy=/etc/nginx/conf.d/alpha-catcher-worker-prod.conf
helper="$(cd -- "$(dirname -- "$0")" && pwd)/alpha-catcher-worker-prod/prepare.mjs"
fail() { echo "$*" >&2; exit 1; }
[[ "$mode" == plan || "$mode" == apply || "$mode" == rollback ]] || fail 'Use plan, apply ou rollback.'
[[ "$mode" != apply || $(id -u) == 0 ]] || fail 'Apply exige sudo.'
if [[ "$mode" == rollback ]]; then
  [[ $(id -u) == 0 ]] || fail 'Rollback exige sudo.'
  [[ -f "$root/installed" && -f "$unit" && -f "$proxy" ]] || fail 'Inventário da instalação ausente.'
  [[ $(sha256sum "$unit" "$proxy") == "$(cat "$root/installed")" ]] || fail 'Configuração mudou; rollback automático bloqueado.'
  [[ ! -d /tmp/painel-alpha-logcomex-login.lock ]] || fail 'Coleta ativa; aguarde antes de parar worker.'
  systemctl disable --now alpha-catcher-worker-prod.service
  mv "$unit" "$root/service.disabled"
  mv "$proxy" "$root/proxy.disabled"
  nginx -t
  systemctl reload nginx
  systemctl daemon-reload
  echo 'Worker parado; release, estado e segredo preservados. Reverta as variáveis Vercel e remova somente o hostname desse worker do Tunnel/DNS.'
  exit 0
fi
for executable in "$node" rsync curl nginx systemctl ss flock; do command -v "$executable" >/dev/null || fail "Pré-requisito ausente: $executable"; done
id ialpha >/dev/null
[[ -d "$source/node_modules" && -f "$helper" ]] || fail 'Fonte/runtime ausente.'
"$node" "$helper" verify "$source" "$candidate"
[[ ! -e "$root" && ! -L "$root" && ! -e "$config" && ! -L "$config" && ! -e "$unit" && ! -e "$proxy" ]] || fail 'Instalação ou artefato existente: não será sobrescrito.'
for port in 3301 3302; do
  sockets="$(ss -ltnH "sport = :$port" 2>&1)" || fail 'Não foi possível verificar portas; execute plan com sudo.'
  if [[ "$sockets" == *'Operation not permitted'* ]]; then
    [[ "$mode" == plan && $(id -u) != 0 ]] || fail 'Não foi possível verificar portas.'
    echo "Disponibilidade da porta $port pendente de plan com sudo."
  else [[ -z "$sockets" ]] || fail "Porta ocupada: $port"; fi
done
cat <<EOF
Plano: copiar build validado de $source para $root/releases/; cópia privada de node_modules/Prisma, env, Gmail e sessões.
Serviço: alpha-catcher-worker-prod.service, usuário ialpha, Next 127.0.0.1:3301.
Proxy: $proxy, 127.0.0.1:3302; somente POST /api/internal/alpha-catcher/worker, 8 KB, timeout 180s.
Segredo novo privado: $config (não será impresso).
Não altera staging, banco, DNS, Tunnel nem Vercel. Não inicia coleta.
Publicação pendente: catcher-worker.alpha-comex.com via Cloudflare Tunnel existente -> http://127.0.0.1:3302.
Rollback: sudo bash $0 rollback; preserva release, estado e segredo.
Riscos: reinício perde execuções em memória; mesmo login Logcomex compartilha lock /tmp com staging. Automação externa permanece compartilhada e deve existir em paths absolutos.
EOF
if [[ "$mode" == plan ]]; then
  if [[ $(id -u) == 0 ]]; then "$node" "$helper" preflight "$source" "$candidate"; nginx -t; else echo 'Validação privada de env/Gmail e nginx -t pendente: sudo bash scripts/install-alpha-catcher-worker-prod.sh plan'; fi
  exit 0
fi
[[ $(id -u) == 0 ]] || fail 'Apply exige sudo.'
[[ ! -d /tmp/painel-alpha-logcomex-login.lock ]] || fail 'Coleta em andamento; aguarde.'
"$node" "$helper" preflight "$source" "$candidate"
nginx -t
[[ $(df -Pk /home/ialpha/deployments | awk 'NR==2 {print $4}') -gt 6000000 ]] || fail 'Exija pelo menos 6 GB livres antes da cópia.'
exec 9>/run/lock/alpha-catcher-worker-prod-install.lock
flock -n 9 || fail 'Instalação concorrente.'
# Todas as falhas preservam cópias para diagnóstico; nunca removem artefatos alheios.
install -d -m 0700 "$root" "$root/releases"
unit_created=false
proxy_created=false
finish() {
  local result=$?
  trap - EXIT
  if [[ "$result" != 0 ]]; then
    if [[ "$unit_created" == true ]]; then
      systemctl disable --now alpha-catcher-worker-prod.service || true
      mv "$unit" "$root/service.failed" || true
      systemctl daemon-reload || true
    fi
    if [[ "$proxy_created" == true ]]; then
      mv "$proxy" "$root/proxy.failed" || true
      if nginx -t; then systemctl reload nginx || true; fi
    fi
    echo "Falha: worker novo desativado, cópias preservadas em $root. Revisão manual antes de repetir apply." >&2
  fi
  exit "$result"
}
trap finish EXIT
release="$root/releases/$(date -u +%Y%m%d-%H%M%S)"
mkdir "$release"
rsync -aL --exclude='.env*' --exclude='/.next/cache/' --exclude='*.log' --exclude='*.db' --exclude='*.sqlite*' --exclude='*.sql' "$source/" "$release/"
install -d -m 0700 -o ialpha -g ialpha /home/ialpha/.config/painel-alpha
"$node" "$helper" prepare "$source" "$candidate" "$release" "$config"
chown -R ialpha:ialpha "$root"
chown ialpha:ialpha "$config"
ln -s "$release" "$root/current"
unit_created=true
cat > "$unit" <<EOF
[Unit]
Description=Alpha Catcher production worker
After=network.target
[Service]
Type=simple
User=ialpha
Group=ialpha
WorkingDirectory=$root/current
Environment=NODE_ENV=production
EnvironmentFile=$config
ExecStart=$node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3301
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
proxy_created=true
cat > "$proxy" <<'EOF'
server {
    listen 127.0.0.1:3302;
    server_name catcher-worker.alpha-comex.com;
    client_max_body_size 8k;
    location = /api/internal/alpha-catcher/worker {
        limit_except POST { deny all; }
        proxy_pass http://127.0.0.1:3301;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
    location / { return 404; }
}
EOF
sha256sum "$unit" "$proxy" > "$root/installed"
nginx -t
systemctl daemon-reload
systemctl enable --now alpha-catcher-worker-prod.service
ready=false
for _ in {1..30}; do
  code="$(curl -s --max-time 2 -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3301/api/internal/alpha-catcher/worker -H 'Content-Type: application/json' -d '{}' || true)"
  if [[ "$code" == 401 ]]; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then systemctl disable --now alpha-catcher-worker-prod.service; fail 'Smoke falhou; worker parado, arquivos preservados. Use rollback.'; fi
systemctl reload nginx
proxy_ready=false
for _ in {1..30}; do
  code="$(curl -s --max-time 2 -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3302/api/internal/alpha-catcher/worker -H 'Content-Type: application/json' -d '{}' || true)"
  if [[ "$code" == 401 ]]; then proxy_ready=true; break; fi
  sleep 1
done
[[ "$proxy_ready" == true ]] || fail 'Proxy não ficou disponível após a recarga; instalação desativada.'
[[ $(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3302/api/internal/alpha-catcher/worker -H 'Content-Type: application/json' -d '{}') == 401 ]] || fail 'Proxy falhou; use rollback.'
[[ $(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:3302/) == 404 ]] || fail 'Isolamento do proxy falhou; use rollback.'
"$node" "$(dirname "$helper")/smoke.mjs" "$config"
echo 'Worker instalado e smoke local aprovado. DNS/Tunnel/TLS e variáveis Vercel ainda pendentes; consulte docs/alpha-catcher-worker-producao-independente.md.'
