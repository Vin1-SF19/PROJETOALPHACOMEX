#!/usr/bin/env bash
set -Eeuo pipefail
source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
deploy_root=/home/ialpha/deployments/painel-alpha-stage
release="$(readlink -f "$deploy_root/current")"
node=/home/ialpha/.config/nvm/versions/node/v22.22.3/bin/node
action="${1:-apply}"
[[ $(id -u) == 0 ]] || { echo 'Execute com sudo.' >&2; exit 1; }
[[ "$release" == "$deploy_root/releases/"* && -d "$release/scripts" ]] || exit 1
backup="$release/scripts/.alpha-catcher-session-backup"
control() {
  runuser -u ialpha -- "$node" --env-file="$release/.env" "$release/scripts/alpha-catcher-session.mjs" "$1"
}
case "$action" in
  enable|disable|status) control "$action"; exit 0 ;;
  apply|rollback) ;;
  *) echo 'Use apply, rollback, enable, disable ou status.' >&2; exit 1 ;;
esac
exec 9>"$deploy_root/deploy.lock"
flock -n 9 || { echo 'Outro deploy está em andamento.' >&2; exit 1; }
[[ ! -d /tmp/painel-alpha-logcomex-login.lock ]] || { echo 'Finalize a importação Logcomex atual antes de alterar o worker.' >&2; exit 1; }
if [[ "$action" == apply ]]; then
  "$node" --check "$source_root/scripts/alpha-catcher-session.mjs"
  "$node" --check "$source_root/scripts/alpha-catcher-logcomex.mjs"
  if [[ ! -d "$backup" ]]; then
    mkdir -m 0700 "$backup"
    cp -p "$release/scripts/alpha-catcher-logcomex.mjs" "$backup/alpha-catcher-logcomex.mjs"
  fi
  install -o ialpha -g ialpha -m 0644 "$source_root/scripts/alpha-catcher-session.mjs" "$release/scripts/.alpha-catcher-session-next.mjs"
  mv -Tf "$release/scripts/.alpha-catcher-session-next.mjs" "$release/scripts/alpha-catcher-session.mjs"
  install -o ialpha -g ialpha -m 0644 "$source_root/scripts/alpha-catcher-logcomex.mjs" "$release/scripts/.alpha-catcher-logcomex-next.mjs"
  mv -Tf "$release/scripts/.alpha-catcher-logcomex-next.mjs" "$release/scripts/alpha-catcher-logcomex.mjs"
  echo 'Reutilização de sessão instalada. Valerá na próxima importação; não exige reinício.'
  control status
else
  [[ -f "$backup/alpha-catcher-logcomex.mjs" ]] || { echo 'Backup do worker anterior não encontrado.' >&2; exit 1; }
  "$node" --check "$backup/alpha-catcher-logcomex.mjs"
  install -o ialpha -g ialpha -m 0644 "$backup/alpha-catcher-logcomex.mjs" "$release/scripts/.alpha-catcher-logcomex-next.mjs"
  mv -Tf "$release/scripts/.alpha-catcher-logcomex-next.mjs" "$release/scripts/alpha-catcher-logcomex.mjs"
  echo 'Worker anterior restaurado. Próxima importação usa o login completo original.'
fi
