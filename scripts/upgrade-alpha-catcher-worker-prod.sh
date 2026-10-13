#!/usr/bin/env bash
set -Eeuo pipefail

action="${1:-}"
source="${2:-}"
manifest="${3:-}"
root=/home/ialpha/deployments/alpha-catcher-worker-prod
current="$root/current"
unit=/etc/systemd/system/alpha-catcher-worker-prod.service
proxy=/etc/nginx/conf.d/alpha-catcher-worker-prod.conf
config=/home/ialpha/.config/painel-alpha/alpha-catcher-worker-prod.env
node=/home/ialpha/.config/nvm/versions/node/v22.22.3/bin/node
service=alpha-catcher-worker-prod.service
script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
fail() { echo "$*" >&2; exit 1; }
[[ "$action" == plan || "$action" == apply || "$action" == rollback ]] || fail 'Uso: upgrade-alpha-catcher-worker-prod.sh plan|apply <release> <manifesto> | rollback'
if [[ "$action" != rollback ]]; then [[ -n "$source" && -n "$manifest" ]] || fail 'Informe release e manifesto explícitos.'; fi
[[ $(id -u) == 0 ]] || fail 'Inspeção segura exige sudo; nenhuma alteração executada.'
for command in "$node" nginx systemctl curl rsync sha256sum flock pgrep du df awk; do command -v "$command" >/dev/null || fail "Pré-requisito ausente: $command"; done
[[ -f "$unit" && -f "$proxy" && -f "$config" && ! -L "$unit" && ! -L "$proxy" && ! -L "$config" ]] || fail 'Arquivos da instalação ausentes ou inseguros.'
[[ -f "$root/installed" && -L "$current" ]] || fail 'Inventário/current ausente.'
sha256sum -c "$root/installed" >/dev/null || fail 'Unit/proxy divergiram do inventário.'
[[ $(systemctl show "$service" --property=LoadState --value) == loaded ]] || fail 'Estado do serviço não confirmado.'
active_state="$(systemctl show "$service" --property=ActiveState --value)"
[[ "$active_state" == active || ( "$action" == rollback && "$active_state" == failed ) ]] || fail 'Estado do worker não permite operação.'
[[ $(systemctl show "$service" --property=WorkingDirectory --value) == "$current" ]] || fail 'WorkingDirectory inesperado.'
[[ $(systemctl show "$service" --property=FragmentPath --value) == "$unit" ]] || fail 'Unit inesperada.'
[[ $(stat -c %a "$config") == 600 ]] || fail 'Permissão do segredo inesperada.'
old="$(readlink -f "$current")"
[[ "$old" == "$root/releases/"* && -d "$old" && -s "$old/.next/BUILD_ID" ]] || fail 'Release atual inválida.'
[[ ! -d /tmp/painel-alpha-logcomex-login.lock ]] || fail 'Lock de coleta ativo.'
if [[ "$active_state" == active ]]; then
  [[ $(find /proc/[0-9]*/cwd -lname "$old" -print -quit 2>/dev/null | wc -l) -ge 1 ]] || fail 'Processo do worker não confirmado.'
fi
if pgrep -f '[/]scripts/alpha-catcher-(logcomex|stream)\.mjs' >/dev/null; then fail 'Processo de coleta ativo; aguarde.'; fi
nginx -t >/dev/null
if [[ "$action" != rollback ]]; then
  "$node" "$script_dir/alpha-catcher-worker-prod/verify-upgrade.mjs" "$source" "$manifest"
  source="$(readlink -f "$source")"
  [[ "$source" != "$old" && "$source" != "$root/"* ]] || fail 'Fonte não pode ser a release ativa nem o destino.'
  [[ -s "$source/.next/BUILD_ID" ]] || fail 'Fonte sem build.'
  needed_kb="$(du -sk "$source" | awk '{print $1}')"
  available_kb="$(df -Pk "$root" | awk 'NR==2 {print $4}')"
  [[ "$available_kb" -gt $((needed_kb + 1048576)) ]] || fail 'Espaço insuficiente para cópia da release e margem de 1 GiB.'
fi
if [[ "$action" != rollback ]]; then
  [[ $(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3302/api/internal/alpha-catcher/worker -H 'Content-Type: application/json' -d '{}') == 401 ]] || fail 'Worker atual indisponível.'
fi

if [[ "$action" == plan ]]; then
  echo "Plano somente leitura: $source -> $root/releases/<timestamp>; current atual $old."
  echo 'Apply copia release, preserva segredo e release antiga, troca current, reinicia somente o worker e executa smoke local.'
  echo 'Rollback usa o inventário de upgrade e restaura o current anterior sem apagar releases.'
  exit 0
fi

exec 9>/run/lock/alpha-catcher-worker-prod-install.lock
flock -n 9 || fail 'Outra operação do worker está em andamento.'
[[ ! -d /tmp/painel-alpha-logcomex-login.lock ]] || fail 'Lock de coleta ativo.'
if pgrep -f '[/]scripts/alpha-catcher-(logcomex|stream)\.mjs' >/dev/null; then fail 'Processo de coleta ativo; aguarde.'; fi
if [[ "$action" == rollback ]]; then
  [[ -f "$root/upgrade-previous" ]] || fail 'Inventário de rollback ausente.'
  previous="$(cat "$root/upgrade-previous")"
  [[ "$previous" == "$root/releases/"* && -d "$previous" && "$previous" != "$old" ]] || fail 'Release anterior inválida.'
  [[ $(cat "$root/upgrade-current") == "$old" ]] || fail 'Current mudou após upgrade; rollback bloqueado.'
  next="$root/.current-rollback-$$"
  ln -s "$previous" "$next"
  mv -Tf "$next" "$current"
  if ! systemctl restart "$service" || ! "$node" "$script_dir/alpha-catcher-worker-prod/smoke.mjs" "$config"; then
    ln -s "$old" "$next"
    mv -Tf "$next" "$current"
    systemctl restart "$service" || true
    fail 'Rollback falhou; current de origem restaurado. Inspecione o serviço.'
  fi
  echo 'Release anterior restaurada; release nova e segredo preservados.'
  exit 0
fi

[[ ! -e "$root/upgrade-previous" && ! -e "$root/upgrade-current" ]] || fail 'Rollback de upgrade anterior pendente; revisão manual necessária.'
release="$root/releases/$(date -u +%Y%m%d-%H%M%S)-upgrade"
[[ ! -e "$release" ]] || fail 'Destino já existe.'
mkdir "$release"
rsync -aL --exclude='.env*' --exclude='/.next/cache/' --exclude='*.log' --exclude='*.db' --exclude='*.sqlite*' --exclude='*.sql' "$source/" "$release/"
for env_file in .env .env.local .env.production .env.production.local; do
  if [[ -f "$old/$env_file" ]]; then install -o ialpha -g ialpha -m 0600 "$old/$env_file" "$release/$env_file"; fi
done
chown -R ialpha:ialpha "$release"
"$node" "$script_dir/alpha-catcher-worker-prod/verify-upgrade.mjs" "$release" "$manifest" || fail 'Cópia divergiu da fonte.'
[[ ! -d /tmp/painel-alpha-logcomex-login.lock ]] || fail 'Coleta iniciada durante a cópia; current preservado.'
if pgrep -f '[/]scripts/alpha-catcher-(logcomex|stream)\.mjs' >/dev/null; then fail 'Coleta iniciada durante a cópia; current preservado.'; fi
printf '%s\n' "$old" > "$root/upgrade-previous"
printf '%s\n' "$release" > "$root/upgrade-current"
next="$root/.current-upgrade-$$"
ln -s "$release" "$next"
mv -Tf "$next" "$current"
if ! systemctl restart "$service" || ! "$node" "$script_dir/alpha-catcher-worker-prod/smoke.mjs" "$config"; then
  ln -s "$old" "$next"
  mv -Tf "$next" "$current"
  systemctl restart "$service" || true
  fail 'Smoke falhou; current anterior restaurado. Inspecione o serviço.'
fi
echo "Upgrade concluído: $release. Release anterior e segredo preservados."
