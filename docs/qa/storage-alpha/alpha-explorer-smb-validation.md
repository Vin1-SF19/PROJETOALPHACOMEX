# Alpha Explorer SMB — validação de implementação

Data: 2026-09-16

## Resultado

Gate local/sintético: **PASS com ressalvas externas**.

Gate para credenciais QNAP reais e exposição pública: **BLOQUEADO** até provisionar Vault/gateway e provar ACL diferencial com duas contas QNAP em diretório sintético.

## Evidências

Backup Vault usado na migration: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-16T14-28-25-978Z.sql`, 130.588.268 bytes, SHA-256 `3360804afea499772d826198b88f6dc1495be680401308ce01a0f954efce886b`. A restauração temporária confirmou 312 tabelas, 129.409 registros, `integrity_check=ok` e zero violações de chave estrangeira antes da escrita em produção.

| Comando | Resultado | Observação |
|---|---|---|
| Vitest SMB direcionado | PASS — 13/13 | Tickets, cliente direto, status pelo control plane e reconciliação de metadados sem senha. |
| Pytest gateway | PASS — 20/20 | Administração ator/alvo, Vault/CAS/rollback, metadados opacos, múltiplas shares, bloqueio de principal privilegiado, replay, path e operações SMB simuladas. |
| ESLint do escopo SMB | PASS | Sem erros nos arquivos funcionais novos. |
| `npm run build` | PASS | Next.js compilou o Explorer, Administração QNAP e `/api/alpha-explorer/smb/admin/status`. O projeto pula typecheck no build. |
| `npm run storage:doctor` | PASS | QuObjects e Vercel Blob responderam; rollback legado preservado. |
| `npm run explorer:smb:doctor` sintético | PASS | Flags, TLS/loopback e separação de issuer/origin validados. |
| `npm run explorer:smb:health` contra gateway local sintético | PASS | Ticket Node → gateway Python validado ponta a ponta. |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` | FAIL externo | Em uma execução passou; após mudanças concorrentes de outra IA voltou a falhar em `ExclusaoFiscal`, gerador de documentos, script SQLite, Bibble `.orig` e Radar. Nenhum erro SMB apareceu. |
| `npm test` | FAIL externo | 3.226 passaram, 1 todo; 20 falharam em Alpha SEO, BPM, Onyx, parceiros, apresentações e gerador de documentos. |
| `npm run lint` | FAIL externo | 3.711 ocorrências preexistentes/concorrentes fora do Explorer; lint do escopo SMB passou. |
| `npm run explorer:smb:health` sintético | PASS | Runtime stage assinou com apenas sua chave e o gateway FastAPI local validou o ticket. |
| CodeRabbit uncommitted | BLOQUEADO | Binário `~/.local/bin/coderabbit` não está instalado neste host. |
| Prisma/Vault migration | PASS | Backup de produção verificado; dry-run transacional em restauração; 7 statements aditivos aplicados; tabela remota vazia com 14 colunas, 3 FKs, 6 índices explícitos e zero violações. |

## Segurança confirmada no código/testes

- senha QNAP não passa pela API do Painel e não fica em Turso/browser storage;
- Turso guarda somente metadados reconciliados por consulta server-side autenticada ao gateway; resposta incompleta falha fechada;
- cada runtime do Painel carrega somente sua própria autoridade; ticket HS256 tem TTL 45 s, resource/scope/target/size/offset e anti-replay SQLite;
- vínculo usa `(iss, aud, sub)` e principal QNAP não pode ser vinculado a dois usuários;
- gateway não usa o mount técnico nem possui fallback de identidade;
- handles são opacos e vinculados ao binding completo `(iss, aud, sub)`;
- erros de validação não refletem senha e o gateway aplica rate limit persistente por binding, cliente e principal pseudonimizado;
- o principal QNAP de um binding é imutável, inclusive após unlink; rotação aceita somente a mesma conta;
- Vault exige HTTPS fora de testes loopback;
- gateway recusa segredos HMAC iguais em stage/produção e limita offset de listagem a 2.000;
- temporário de upload usa o mesmo diretório/ACL do destino;
- commit verifica tamanho e não sobrescreve destino;
- move verifica SHA-256 e tamanho antes de apagar origem;
- lixeira é reversível e distinta de `@Recycle`/snapshot;
- logs não incluem senha, ticket, principal ou path completo.

## Pendências obrigatórias do piloto

1. HashiCorp Vault KV v2 real e policy mínima.
2. Serviço gateway dedicado com TLS/tunnel/firewall aprovados.
3. Duas contas QNAP sintéticas com ACLs distintas.
4. Teste negativo de administrador do Painel sem ACL QNAP.
5. Smoke real leitura/escrita/checksum/cleanup.
6. Inspeção de logs e estado SQLite após falha de rede.
7. Prova real no QNAP de que contas piloto não criam symlink/reparse, incluindo tentativa concorrente; o cliente revalida cada segmento, mas APIs SMB por path ainda têm janela TOCTOU entre `stat` e `open/rename`.
