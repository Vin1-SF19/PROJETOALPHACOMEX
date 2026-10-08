#!/usr/bin/env bash
set -Eeuo pipefail

# Ativa somente um candidato já compilado. Não executa migrations nem builds.
candidate="${1:-/var/tmp/painel-alpha-shared-history-candidate}"
deploy_root=/home/ialpha/deployments/painel-alpha-stage
service=painel-alpha-stage.service
node=/home/ialpha/.config/nvm/versions/node/v22.22.3/bin/node
manifest="$candidate/shared-history-stage-manifest.json"

[[ $(id -u) == 0 ]] || { echo 'Execute com sudo para ativar o staging.' >&2; exit 1; }
[[ -f "$manifest" && -s "$candidate/.next/BUILD_ID" ]] || { echo 'Candidato não validado.' >&2; exit 1; }
[[ ! -d /tmp/painel-alpha-logcomex-login.lock ]] || { echo 'Há uma importação Logcomex em andamento; tente depois.' >&2; exit 1; }
[[ $(systemctl show "$service" --property=WorkingDirectory --value) == "$deploy_root/current" ]] || { echo 'Configuração inesperada do serviço.' >&2; exit 1; }

exec 9>"$deploy_root/deploy.lock"
flock -n 9 || { echo 'Outro deploy está em andamento.' >&2; exit 1; }
previous="$(readlink -f "$deploy_root/current")"
"$node" - "$manifest" "$candidate" "$previous" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [manifestFile, candidate, previous] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
if (manifest.baseRelease !== previous || manifest.validated !== true) {
  throw new Error('A versão ativa mudou ou o candidato não foi validado. Reprepare antes de publicar.');
}
if (fs.readFileSync(path.join(candidate, '.next/BUILD_ID'), 'utf8').trim() !== manifest.buildId) {
  throw new Error('Build do candidato divergente.');
}
for (const [file, expected] of Object.entries(manifest.sha256)) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(candidate, file))).digest('hex');
  if (hash !== expected) throw new Error(`Arquivo do candidato divergente: ${file}`);
}
const routes = JSON.parse(fs.readFileSync(path.join(candidate, '.next/server/app-paths-manifest.json'), 'utf8'));
if (!routes['/api/alpha-catcher/historico/route'] || !routes['/api/alpha-catcher/historico/[id]/route']) throw new Error('Rotas de histórico ausentes.');
NODE

release="$deploy_root/releases/$(date -u +%Y%m%d-%H%M%S)-alpha-catcher-shared-history"
mkdir "$release"
rsync -a --exclude='/node_modules' --exclude='/tests/' --exclude='/.aiox-core/' \
  --exclude='/.cache/' --exclude='/coverage/' --exclude='/.next/cache/' --exclude='.env*' \
  --exclude='*.log' --exclude='*.db' --exclude='*.sqlite*' --exclude='*.sql' \
  "$candidate/" "$release/"
# Mantém as dependências da mesma versão usada no build. Nenhum prisma generate.
[[ ! -e "$release/node_modules" && ! -L "$release/node_modules" ]] || {
  echo 'Destino node_modules inesperado; ativação interrompida.' >&2
  exit 1
}
cp -alT "$(readlink -f "$previous/node_modules")" "$release/node_modules"
# Prisma precisa de uma cópia própria para futuras gerações não alterarem a release.
if [[ -d "$release/node_modules/.prisma/client" ]]; then
  cp -a "$previous/node_modules/.prisma/client" "$release/node_modules/.prisma/client-private"
  mv "$release/node_modules/.prisma/client" "$release/node_modules/.prisma/client-hardlinks"
  mv "$release/node_modules/.prisma/client-private" "$release/node_modules/.prisma/client"
  # Remove apenas os links recém-criados, sem tocar os arquivos da versão anterior.
  find "$release/node_modules/.prisma/client-hardlinks" -depth -delete
fi
for env_file in .env .env.local .env.production .env.production.local; do
  [[ ! -f "$previous/$env_file" ]] || install -m 0600 "$previous/$env_file" "$release/$env_file"
done
# Não altera o dono dos inodes compartilhados com a release anterior.
find "$release" -path "$release/node_modules" -prune -o -exec chown -h ialpha:ialpha {} +
[[ ! -d "$release/node_modules/.prisma/client" ]] || chown -R ialpha:ialpha "$release/node_modules/.prisma/client"

activated=false
smoke_pid=''
cleanup() {
  [[ -z "$smoke_pid" ]] || kill -TERM -- "-$smoke_pid" 2>/dev/null || true
}
finish() {
  local result=$?
  trap - EXIT
  cleanup
  if [[ "$activated" == true && "$result" != 0 ]]; then
    ln -s "$previous" "$deploy_root/.rollback-shared-history-$$"
    mv -Tf "$deploy_root/.rollback-shared-history-$$" "$deploy_root/current"
    systemctl restart "$service" || true
    echo "Versão anterior restaurada: $previous" >&2
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

port=''
for candidate_port in 3310 3311 3312 3313 3314 3315; do
  if [[ -z "$(ss -ltnH "sport = :$candidate_port")" ]]; then port="$candidate_port"; break; fi
done
[[ -n "$port" ]] || { echo 'Sem porta livre para validar a release.' >&2; exit 1; }
setsid runuser -u ialpha -- bash -c 'cd "$1"; exec "$2" node_modules/next/dist/bin/next start -p "$3"' \
  bash "$release" "$node" "$port" > "$release/stage-smoke.log" 2>&1 9>&- &
smoke_pid=$!
ready=false
for _ in {1..30}; do
  if curl -fs --max-time 3 -o /dev/null "http://127.0.0.1:$port/"; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
[[ $(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' -X POST \
  "http://127.0.0.1:$port/api/alpha-catcher/logcomex" -H 'Content-Type: application/json' -d '{}') == 401 ]]
[[ $(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/alpha-catcher/historico") == 401 ]]
[[ $(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/alpha-catcher/historico/198") == 401 ]]
cleanup
wait "$smoke_pid" 2>/dev/null || true
smoke_pid=''

ln -s "$release" "$deploy_root/.current-shared-history-$$"
activated=true
mv -Tf "$deploy_root/.current-shared-history-$$" "$deploy_root/current"
systemctl restart "$service"
ready=false
for _ in {1..30}; do
  if systemctl is-active --quiet "$service" && curl -fs --max-time 3 -o /dev/null http://127.0.0.1:3300/; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
[[ $(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' -X POST \
  http://127.0.0.1:3300/api/alpha-catcher/logcomex -H 'Content-Type: application/json' -d '{}') == 401 ]]
activated=false
echo "Staging publicado: $release"
echo "Versão anterior preservada: $previous"
echo 'Acesse https://stagepainel-alpha.alpak.ai/PainelAlpha/AlphaCatcher'
