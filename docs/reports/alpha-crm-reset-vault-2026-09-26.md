# Vault — reset completo do Alpha CRM (2026-09-26)

**Estado:** BLOQUEADO para execução no banco remoto. Esta preparação não alterou dados.

## Banco e operação

- Ambiente: Turso remoto configurado por `TURSO_DATABASE_URL` em `.env.local`, tratado como produção. `prisma/dev.db` não é a fonte deste plano.
- Identidades que devem permanecer: `financeiro` / Financeiro (`cmsd9yw74000adzggrw91um3j`), `operacional` / Operacional (`cmssy4gd60000dz7sn1gdl3yi`) e `comercial` / Revisão de Radar (`cmsd9yvb90000dzggt1gjl980`). O pipeline legado `radar` (`cmsd9yx4v000gdzggtz2u90mq`) será excluído.
- Operação 🔴 destrutiva: limpar todas as tabelas `Bpm*` exceto `BpmPipeline`, em ordem calculada pelas FKs, e excluir qualquer pipeline fora dos três IDs acima. Isso inclui etapas, 1.345 cards, campos, valores, regras, validações, automações, tarefas, anexos registrados, histórico e auditoria. `NolossLead.promotedCardId` ligado a um card vira `NULL` por FK; clientes, usuários, contratos, blobs de storage e eventos externos não são excluídos.
- Nenhuma migration estrutural: `prisma migrate diff` retornou migração vazia.

## Execução proposta

1. Suspender temporariamente **todas** as gravações do CRM e os jobs BPM em todas as instâncias que usam o Turso remoto. A operação causa indisponibilidade temporária do CRM; não interromper outros módulos sem necessidade. Recontar dados e conferir os quatro pipelines e os três IDs preservados.
2. Criar novo backup completo em `database-backups/pre-change/` com `node scripts/turso-backup.mjs 'reset completo CRM aprovado'`. Restaurar em cópia isolada com `node scripts/verify-turso-backup.mjs <dump.sql> <manifest.json>` e conferir SHA-256, tamanho, 332 tabelas ou a contagem atual, linhas, `integrity_check=ok` e zero violações de FK. Backup máximo de 48 horas.
3. Executar `node scripts/bpm-reset-completo.mjs --preview` e `node scripts/bpm-reset-completo.mjs --simulate --backup=<dump.sql> --manifest=<manifest.json>`. Os fingerprints do backup e do banco vivo devem coincidir. O fingerprint cobre identidades e contagens, não alterações de linhas que preservem contagens; por isso as gravações devem permanecer suspensas.
4. Somente com confirmação explícita do usuário sobre **este plano**, executar `node scripts/bpm-reset-completo.mjs --apply --backup=<dump.sql> --manifest=<manifest.json> --expect-fingerprint=<fingerprint da prévia> --approval=RESET_COMPLETO_ALPHA_CRM`. O script usa transação, checa todos os `Bpm*` vazios, três IDs preservados, integridade e FKs antes do commit; falha provoca rollback.
5. Conferir por leitura no Turso: apenas três pipelines, zero etapas/cards/campos/validações/configurações BPM e nenhuma violação de FK. Retomar gravações e jobs configuráveis após confirmação do estado. O job legado por nomes de etapas permanece inerte no código desta entrega.

## Evidências e riscos

- Backup completo criado às 13:17 UTC em `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-26T13-17-12-005Z.sql` (177.812.468 bytes, SHA-256 `58a598f5d19eda162f05adbcf7c006e4a5b2f0b761552b27f31d177db0449f48`, 332 tabelas, 190.132 linhas). Restauração isolada aprovada. **Este backup está desatualizado para a aplicação:** a prévia seguinte mostrou 11.343 registros BPM contra 10.894 no backup. É necessário um novo backup sob pausa de gravações.
- Simulação na cópia do backup: 66 tabelas BPM, 10.894 registros antes, 10.891 excluídos, incluindo 1.345 cards; somente três registros de pipeline depois, `integrity_check=ok`, zero violações de FK. Uma referência externa de lead foi desvinculada.
- Riscos: perda deliberada dos dados e histórico do CRM, indisponibilidade temporária durante o bloqueio de gravações, links antigos para cards sem destino, referências de anexos removidas do banco enquanto blobs permanecem no storage, eventos externos que podem continuar no calendário. O dump SQL restaura dados do banco, não efeitos externos.
- Alternativa não destrutiva: arquivar os quatro pipelines e iniciar configuração nova isolada, preservando cards e histórico antigos. O usuário escolheu exclusão física no esclarecimento “Sim, tudo”.
- Rollback: antes do commit, transação faz rollback automático em qualquer falha. Após commit, restauração do dump completo somente com novo plano/consentimento e gravações ainda suspensas, pois ela sobrescreveria alterações feitas depois do backup. Não restaurar um dump antigo sobre dados novos.

**Confirmação operacional pendente:** a resposta “Sim, tudo” definiu o escopo, mas foi dada antes deste inventário, dos riscos, da pausa e do plano de execução. Nenhuma mutação remota está autorizada por este documento.
