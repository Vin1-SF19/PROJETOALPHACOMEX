# Alpha Explorer SMB Gateway — fundação local

Gateway server-only que autentica cada operação com ticket HMAC curto e abre uma sessão SMB usando exclusivamente a conta QNAP vinculada. Não usa o mount técnico como fallback e não persiste credenciais no Painel/Turso.

## Estado desta entrega

- Contrato `v1`: status de vínculo, enrollment/rotação/desvinculação administrativos write-only, listagem multi-share, mkdir, download com Range, upload em chunks, rename, move e lixeira/restauração.
- Tickets single-use de 45 segundos, com `kid`, `iss`, `aud`, `sub`, `origin`, `scope`, `resource`, `jti`, `iat`, `nbf`, `exp` e `auth_time`.
- Anti-replay durável e atômico em SQLite local.
- Handles de path opacos, efêmeros e vinculados ao binding completo `(iss, aud, sub)`.
- Segredos em HashiCorp Vault KV v2. O store em memória é recusado fora de `environment=test`.
- Cada operação usa um connection cache `smbclient` privado e descartável, impedindo reuso entre identidades/operações concorrentes.
- CORS limitado às origens exatas de produção e stage.

Uploads usam chunks de até 8 MiB diretamente navegador → gateway, estado SQLite persistente, temporário opaco no mesmo diretório de destino e commit com ticket novo. O arquivo só recebe o nome final após tamanho verificado e rename sem overwrite. Cancelamento e reconciliação de sessões incompletas estão disponíveis.

Rename no mesmo diretório usa rename atômico sem overwrite, inclusive para diretórios. Move de arquivo usa copy → verificação de tamanho → delete; falha no delete retorna `MOVE_RECONCILIATION_REQUIRED` e mantém ambas as cópias. Movimento recursivo de diretório é recusado nesta versão. A lixeira reservada fica sob o diretório pai autorizado, é listável de forma paginada e não equivale ao `@Recycle` nem a snapshots do QNAP.

## Configuração server-only do Painel

Configure no runtime correspondente, nunca com prefixo `NEXT_PUBLIC_`:

```text
ALPHA_EXPLORER_SMB_ENABLED=false
ALPHA_EXPLORER_SMB_ENROLLMENT_ENABLED=false
ALPHA_EXPLORER_SMB_WRITE_ENABLED=false
ALPHA_EXPLORER_SMB_GATEWAY_URL=https://gateway-aprovado.example
ALPHA_EXPLORER_SMB_AUDIENCE=alpha-explorer-smb-gateway
ALPHA_EXPLORER_SMB_PRODUCTION_ORIGIN=https://painel.alpha-comex.com
ALPHA_EXPLORER_SMB_STAGE_ORIGIN=https://stagealpha-sistema.alpak.ai
ALPHA_EXPLORER_SMB_RUNTIME=stage
ALPHA_EXPLORER_SMB_ISSUER=alpha-explorer-stage
ALPHA_EXPLORER_SMB_TICKET_KID=identificador-publico-da-chave-stage
ALPHA_EXPLORER_SMB_TICKET_SECRET=<segredo-stage-com-32-ou-mais-bytes>
```

No deployment de produção, use `RUNTIME=production` e a autoridade de produção. Cada runtime do Painel recebe somente sua própria chave; apenas o gateway verificador recebe as duas. Produção e stage não compartilham issuer, key ID nem segredo.

## Configuração do gateway

```text
SMB_GATEWAY_ENVIRONMENT=production
SMB_GATEWAY_AUDIENCE=alpha-explorer-smb-gateway
SMB_GATEWAY_PRODUCTION_ORIGIN=https://painel.alpha-comex.com
SMB_GATEWAY_STAGE_ORIGIN=https://stagealpha-sistema.alpak.ai
SMB_GATEWAY_ISSUER_PRODUCTION=alpha-explorer-production
SMB_GATEWAY_ISSUER_STAGE=alpha-explorer-stage
SMB_GATEWAY_TICKET_KID_PRODUCTION=identificador-publico-da-chave-prod
SMB_GATEWAY_TICKET_KID_STAGE=identificador-publico-da-chave-stage
SMB_GATEWAY_TICKET_SECRET_PRODUCTION=<segredo>
SMB_GATEWAY_TICKET_SECRET_STAGE=<segredo>
SMB_GATEWAY_SMB_SERVER=<host-interno-do-qnap>
# Opcional: quando vazio/ausente, as shares são descobertas no QNAP com a identidade vinculada.
# Quando preenchido, funciona como restrição adicional sobre o catálogo descoberto.
SMB_GATEWAY_SMB_SHARES=
SMB_GATEWAY_SMB_PORT=445
SMB_GATEWAY_SECRET_STORE=vault
SMB_GATEWAY_VAULT_URL=https://vault-interno.example
SMB_GATEWAY_VAULT_TOKEN_FILE=/run/credentials/alpha-explorer-vault-token
SMB_GATEWAY_VAULT_CA_CERT=/etc/ssl/certs/vault-interno-ca.pem
SMB_GATEWAY_VAULT_MOUNT=alpha-explorer
SMB_GATEWAY_VAULT_PREFIX=smb-bindings
SMB_GATEWAY_REPLAY_DB_PATH=/var/lib/alpha-explorer-gateway/replay.sqlite3
SMB_GATEWAY_STATE_DB_PATH=/var/lib/alpha-explorer-gateway/state.sqlite3
SMB_GATEWAY_HANDLE_TTL_SECONDS=300
```

No serviço local, prefira `SMB_GATEWAY_TICKET_SECRET_PRODUCTION_FILE` e `SMB_GATEWAY_TICKET_SECRET_STAGE_FILE` apontando para arquivos injetados por `systemd LoadCredential`. Quando definidos, eles têm precedência sobre os valores diretos. O Painel/Vercel continua recebendo seus segredos server-only pelo gerenciador de ambiente da plataforma.

O arquivo do token Vault deve ser injetado pelo supervisor, legível somente pelo usuário do serviço e nunca versionado. O Vault exige HTTPS fora de testes loopback e valida a CA do sistema ou `SMB_GATEWAY_VAULT_CA_CERT`. O prefixo e paths do Vault são derivados da configuração e do triplo assinado `(iss, aud, sub)`; nenhum path de cofre é aceito do cliente.

O gateway consulta o catálogo de shares do próprio QNAP com a identidade vinculada e testa acesso real a cada share antes de mostrá-la. `SMB_GATEWAY_SMB_SHARES` é uma restrição opcional: quando preenchida, somente shares simultaneamente descobertas, acessíveis e presentes nessa lista aparecem. `ONYX`, shares administrativas/ocultas e shares de impressão pertencem a outros escopos e são sempre recusadas.

No KV v2, conceda somente `create`, `read`, `update` e `delete` sob o prefixo dedicado. O gateway mantém índices hash para impedir que a mesma conta seja vinculada a dois bindings e para tornar o principal de cada binding imutável. A desvinculação remove a credencial utilizável, mas preserva esses marcadores: religar aceita somente a mesma conta QNAP; transferência de conta exige procedimento administrativo futuro, não exposto na UI. Não conceda `list` fora desse prefixo.

## Instalação local e testes

```bash
python3 -m venv ops/alpha-explorer-gateway/.venv
ops/alpha-explorer-gateway/.venv/bin/pip install -r ops/alpha-explorer-gateway/requirements.txt
ops/alpha-explorer-gateway/.venv/bin/pytest -q ops/alpha-explorer-gateway/tests
```

Após provisionamento por DevOps, o processo pode usar:

```bash
ops/alpha-explorer-gateway/.venv/bin/uvicorn app.main:app --app-dir ops/alpha-explorer-gateway --host 127.0.0.1 --port 8765 --proxy-headers --forwarded-allow-ips=127.0.0.1
```

TLS, Cloudflare Tunnel, firewall, systemd e exposição externa continuam bloqueados até aprovação DevOps/Security.

## CLI

Entrada criada: `scripts/alpha-explorer-smb.mjs`. Os scripts de `package.json` a adicionar pela integração responsável são:

```json
{
  "explorer:smb": "tsx --conditions=react-server scripts/alpha-explorer-smb.mjs",
  "explorer:smb:doctor": "tsx --conditions=react-server scripts/alpha-explorer-smb.mjs doctor",
  "explorer:smb:health": "tsx --conditions=react-server scripts/alpha-explorer-smb.mjs health",
  "explorer:smb:admin-status": "tsx --conditions=react-server scripts/alpha-explorer-smb.mjs admin-status",
  "explorer:smb:admin-enroll": "tsx --conditions=react-server scripts/alpha-explorer-smb.mjs admin-enroll",
  "explorer:smb:admin-rotate": "tsx --conditions=react-server scripts/alpha-explorer-smb.mjs admin-rotate",
  "explorer:smb:admin-unlink": "tsx --conditions=react-server scripts/alpha-explorer-smb.mjs admin-unlink"
}
```

Exemplos:

```bash
npm run explorer:smb:doctor
npm run explorer:smb:health -- --user-id=1 --origin=https://stagealpha-sistema.alpak.ai
npm run explorer:smb -- list --user-id=1 --origin=https://stagealpha-sistema.alpak.ai --handle=root
npm run explorer:smb:admin-status -- --actor-user-id=1 --target-user-id=42 --origin=https://stagealpha-sistema.alpak.ai
npm run explorer:smb:admin-enroll -- --actor-user-id=1 --target-user-id=42 --principal=usuario-qnap \
  --execute --confirm=alpha-explorer-smb-admin-enroll
```

Enrollment, rotação e desvinculação são dry-run por padrão. Na execução de enrollment/rotação, a senha é lida exclusivamente de stdin; nunca use argumento, variável exibida ou arquivo versionado.

O gateway exige perfil administrativo, ator e usuário-alvo vinculados no ticket efêmero, nonce, proteção contra replay e rate limit. Enrollment, rotação e desvinculação não exigem reautenticação recente nem justificativa. Mantenha enrollment desabilitado até validar o fluxo administrativo no stage; não contorne o gate criando tickets manualmente.
