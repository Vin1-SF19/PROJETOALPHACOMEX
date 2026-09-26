# Vault Report — BLOQUEADO 🔒

## Ambiente e operação

O alvo é o Turso remoto configurado por `TURSO_DATABASE_URL` em `.env.local`, tratado como produção. A operação é destrutiva: limpar todas as 66 tabelas `Bpm*`, incluindo `BpmPipeline`, sem preservar nenhum pipeline. Nenhuma tabela, coluna ou migration estrutural será removida.

## Plano de execução

1. Pausar temporariamente gravações do CRM e jobs BPM em todas as instâncias que usam esse banco; isso causa indisponibilidade temporária do CRM.
2. Sob a pausa, criar backup completo com `node scripts/turso-backup.mjs 'remoção total dos pipelines Alpha CRM'` em `database-backups/pre-change/` e verificar por restauração isolada com `node scripts/verify-turso-backup.mjs <dump.sql> <manifest.json>`. Conferir SHA-256, tamanho, tabelas, linhas, `integrity_check=ok` e zero violações de FK; idade máxima de 48 horas.
3. Executar `node scripts/bpm-reset-completo.mjs --preview` e `node scripts/bpm-reset-completo.mjs --simulate --backup=<dump.sql> --manifest=<manifest.json>`. Os fingerprints do banco vivo e do backup devem coincidir.
4. Após confirmação explícita do usuário para **este plano**, executar `node scripts/bpm-reset-completo.mjs --apply --backup=<dump.sql> --manifest=<manifest.json> --expect-fingerprint=<fingerprint> --approval=RESET_COMPLETO_ALPHA_CRM`. A exclusão ocorre em transação, na ordem das FKs; qualquer falha anterior ao commit causa rollback.
5. Confirmar por leitura zero pipelines e zero registros nas tabelas BPM, integridade e FKs válidas. Retomar gravações e jobs apenas após verificar o estado.

## Impacto, riscos e alternativa

A exclusão apaga cards, etapas, campos, formulários, valores, validações, regras, tarefas, histórico, anexos registrados, automações e auditoria do CRM. A prévia encontrou 1.345 cards. Links antigos perderão o destino; referências externas para cards podem virar `NULL`. Blobs no storage e eventos em sistemas externos permanecem. A pausa pode tornar o CRM indisponível temporariamente. Alternativa não destrutiva: arquivar os pipelines e criar novos vazios.

## Backup, simulação e rollback

O backup `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-26T13-42-19-367Z.sql` foi gerado às 13:46 UTC, tem 178.623.511 bytes, SHA-256 `067e1ab823c9f4cf5f81a3a04055d1ab5ebb90bfae89524da9a88b247d08d97c`, 332 tabelas e 190.738 linhas. A restauração isolada passou. A simulação nessa cópia terminou com zero pipelines, zero registros BPM, integridade `ok` e zero violações de FK.

Este backup **não corresponde ao estado vivo observado depois**: 11.489 registros BPM no backup contra 11.686 na prévia remota. Portanto, ele não libera a exclusão. Será necessário um novo backup sob pausa, com inventário coincidente.

Antes do commit, falhas causam rollback automático da transação. Após o commit, a recuperação exige restaurar o dump completo com um novo plano e consentimento, pois a restauração sobrescreveria mudanças feitas depois do backup. O dump não restaura efeitos externos.

**Pendências para liberação:** pausa de gravações e jobs, novo backup completo verificado, fingerprints coincidentes e confirmação explícita do usuário sobre esta operação. O pedido inicial define o objetivo, mas não substitui a confirmação exigida pelo `AGENTS.md` após este relatório.

## Execução após a confirmação do usuário

O usuário confirmou diretamente a exclusão após receber o plano. Foi criado um novo backup completo às 14:09 UTC em `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-26T14-09-42-978Z.sql` (178.756.707 bytes, SHA-256 `e48965450885fdf82d504962b25bda88d69fc682b0eece199ee2d81e84b87af6`, 332 tabelas, 190.940 linhas), restaurado e verificado. A prévia remota e a simulação coincidiram no fingerprint `7f57f57c6ff10d8ce95bdcc5ec292effa1d5c9e8d4a4e60ea36fcbd3e6a59e75`.

**Desvio do plano:** não houve pausa global das gravações e jobs. A execução abriu transação remota de escrita, conferiu o fingerprint do banco vivo novamente, apagou os registros e verificou integridade/FKs antes do commit. O resultado do commit foi zero pipelines e zero registros nas 66 tabelas BPM, com `integrity_check=ok` e zero violações de FK.

Na leitura posterior, três pipelines **novos** apareceram às 14:17 UTC, todos vazios e sem `chave`: Revisão de Radar, Financeiro e Operacional. Há três vínculos de setor; etapas, cards, campos, validações e demais conteúdos BPM continuam zerados. A forma desses registros coincide com a criação manual pela action `CriarPipelineBpm`, mas a origem ainda não foi confirmada. Eles foram preservados enquanto se verifica se são o início da reconstrução manual solicitada pelo usuário.

Uma leitura adicional encontrou duas etapas novas, ainda com zero cards, campos e requisitos. Isso indica trabalho novo de configuração após o reset; esses registros foram preservados.

O usuário confirmou posteriormente: "Sim, preserve os novos". Os três pipelines criados após o reset e as configurações novas permanecem intactos.
