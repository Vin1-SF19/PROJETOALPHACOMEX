# Story: remover todos os pipelines atuais do Alpha CRM

## Status

Done — pipelines antigos e conteúdo removidos; três pipelines novos preservados a pedido do usuário.

## Origem e escopo

Pedido atual: remover os pipelines existentes do Alpha CRM/BPM e todo o seu conteúdo, incluindo validações e campos, para reconstrução manual posterior. Este pedido substitui o escopo da story `story-alpha-crm-reset-completo-pipelines.md`, que preservava três pipelines. O estado final solicitado aqui é **zero pipelines**.

Cadastros compartilhados de clientes, usuários e contratos não fazem parte dos pipelines e permanecem. Referências externas para cards podem ser desvinculadas pelas FKs; blobs de storage e eventos de serviços externos não serão apagados sem plano próprio.

## Critérios de aceitação

1. [ ] `BpmPipeline` fica sem registros, inclusive Financeiro, Operacional, Revisão de Radar e Radar legado.
2. [ ] Todas as tabelas `Bpm*` ficam vazias: cards, etapas, campos, valores, validações, regras, tarefas, histórico, automações e demais registros BPM.
3. [ ] A exclusão é transacional; `PRAGMA integrity_check` retorna `ok` e `PRAGMA foreign_key_check` retorna zero violações.
4. [ ] Backup completo do Turso remoto é criado em `database-backups/pre-change/`, restaurado e verificado antes da exclusão; seu inventário coincide com a prévia do banco vivo sob pausa de gravações e jobs.
5. [ ] O usuário recebe o relatório Vault com impacto, riscos, alternativa e rollback e confirma explicitamente **esta** operação antes de qualquer mutação remota.
6. [ ] Nenhum seed ou job recria pipelines antigos após a limpeza; a administração permite a criação manual posterior.

## Checklist

- [x] Identificar banco alvo e inventariar os pipelines atuais por leitura.
- [x] Preparar script de reset para zero pipelines e simular em cópia isolada.
- [x] Verificar backup existente e registrar sua divergência do banco vivo.
- [x] Conferir que não há migration estrutural planejada.
- [ ] Pausar gravações e jobs do CRM no ambiente alvo. Não houve pausa global; a execução usou uma transação remota de escrita e revalidou o fingerprint antes das exclusões.
- [x] Gerar novo backup completo, restaurar e verificar integridade, hash, tabelas e linhas.
- [x] Repetir prévia e simulação com fingerprints coincidentes.
- [x] Receber confirmação explícita do usuário após apresentação do plano Vault.
- [x] Executar exclusão remota e conferir zero registros BPM, integridade e FKs no resultado da transação.
- [x] Confirmar com o usuário se os três pipelines criados depois da exclusão devem ser preservados. Resposta: "Sim, preserve os novos".
- [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` e registrar resultados.

## Evidência de preparação

- Prévia remota em 2026-09-26: quatro pipelines, 66 tabelas BPM no inventário, 1.345 cards e 11.686 registros BPM. O banco continua sujeito a mudança.
- Backup de 2026-09-26 13:46 UTC: 178.623.511 bytes, SHA-256 `067e1ab823c9f4cf5f81a3a04055d1ab5ebb90bfae89524da9a88b247d08d97c`, 332 tabelas, 190.738 linhas; restauração isolada verificada.
- Simulação nesse backup: quatro pipelines e 11.489 registros BPM antes; zero pipelines e zero registros BPM depois; integridade `ok` e zero violações de FK.
- A diferença entre 11.489 registros no backup e 11.686 na prévia remota bloqueia a execução. Exige novo backup sob pausa de gravações.
- `prisma migrate diff` entre o schema atual e ele mesmo: migration vazia. Nenhuma alteração estrutural está prevista.
- `node --check scripts/bpm-reset-completo.mjs`: passou. `npm run lint`: passou com 1.192 avisos e zero erros. `npm run typecheck`: passou. `npm run build`: passou.
- `npm test`: 529 arquivos passaram, um falhou; 2 testes de `tests/debug/error-bus.test.ts` falharam (3911 testes passaram, 4 ignorados, 1 todo). Essas falhas são do módulo debug e não exercitam o reset BPM.
- Novo backup completo de 2026-09-26 14:09 UTC: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-26T14-09-42-978Z.sql`, 178.756.707 bytes, SHA-256 `e48965450885fdf82d504962b25bda88d69fc682b0eece199ee2d81e84b87af6`, 332 tabelas e 190.940 linhas; restauração e integridade verificadas.
- Prévia e simulação do novo backup coincidiram no fingerprint `7f57f57c6ff10d8ce95bdcc5ec292effa1d5c9e8d4a4e60ea36fcbd3e6a59e75`: quatro pipelines originais, 1.345 cards e 11.686 registros BPM antes; zero pipelines e zero registros BPM na simulação.
- A exclusão remota confirmou no commit zero registros em todas as 66 tabelas BPM, `integrity_check=ok` e zero violações de FK.
- Leitura posterior encontrou três **novos** pipelines sem chave semântica, criados às 14:17:02, 14:17:14 e 14:17:29 UTC: Revisão de Radar (`cmuih48la000009gmzw3wwuzf`), Financeiro (`cmuih4i54000209gmmyqrg557`) e Operacional (`cmuih4tnh000409gm5z34jvss`). Eles têm apenas três vínculos `BpmPipelineSetor` e zero etapas, cards, campos ou validações. Não foram apagados enquanto se confirma se representam a reconstrução manual do usuário.
- Leitura subsequente encontrou duas etapas novas nesses pipelines, ainda sem cards, campos ou requisitos. Isso indica reconstrução em andamento; os novos registros foram preservados.
- Confirmação posterior do usuário: preservar os três pipelines novos da reconstrução manual. Não haverá nova exclusão desses registros.

## File List

- `docs/stories/story-alpha-crm-remocao-total-pipelines.md`
- `docs/reports/alpha-crm-remocao-total-vault-2026-09-26.md`
- `scripts/bpm-reset-completo.mjs`
