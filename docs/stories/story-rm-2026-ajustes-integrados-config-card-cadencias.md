# RM-2026 — Ajustes integrados de configurações, card e cadências do Alpha CRM

## Status

Ready for Review — o usuário retirou “investigar a origem” do escopo. A migração de exclusão lógica foi autorizada e aplicada no Turso remoto; as variáveis de produção da Vercel foram configuradas. Upload e cron dependem do próximo deploy para validação operacional.

## Story

Como usuário do Alpha CRM, quero configurar o pipeline e operar o card sem controles duplicados ou bloqueios inesperados, com anexos funcionais e cadências executadas no momento devido, para acompanhar o trabalho na etapa correta.

## Origem e contexto

Pedido direto do usuário nesta conversa, dividido em Configurações, Formulários/Transição, Procedimentos, Tarefas, Anexos e Cadências. Este ajuste complementa `story-alpha-crm-campos-formularios-obrigacoes-por-etapa.md`, `story-rm-2026-e96332-exclusao-procedimentos.md`, `story-rm-2026-158500-cadencia-por-etapa-sem-bloqueio.md` e `story-rm-2026-97cc60-gestao-tarefas-cadencias.md`. O texto “a origem” ainda não tem significado funcional confirmado; nenhuma regra ou alteração desse ponto deve ser presumida.

## Critérios de aceite

1. **Configurações:** na página inicial de Configurações, antes de selecionar um pipeline, o botão/cartão **Base de Conhecimento** não aparece. A navegação de conhecimento dentro do contexto do pipeline continua conforme as opções existentes.
2. **Formulários e transição:** na validação de campos configuráveis para avançar um card, somente campos marcados como obrigatórios **e presentes no formulário publicado da etapa aplicável** bloqueiam o avanço. Campos opcionais, retirados do formulário ou indisponíveis nele não bloqueiam. A prévia de pendências e o comando de movimentação concordam sobre os mesmos campos, inclusive em chamada direta ao servidor. Regras de negócio independentes de campos configuráveis e autorização permanecem ativas.
3. **“A origem”:** fora do escopo por orientação posterior do usuário (“pode pular só essa parte”).
4. **Procedimentos no card:** não existe ação **Adicionar novo procedimento** no card aberto. A aba lateral de Procedimento permanece acessível e mostra os procedimentos aplicáveis com layout simplificado, sem controles duplicados ou seção vazia.
5. **Excluir procedimento nas configurações:** após confirmação e mensagem de sucesso, o procedimento deixa de aparecer na lista corrente de procedimentos disponíveis e deixa de ser oferecido para novas aplicações, inclusive depois de recarregar a página. Registros já materializados em cards seguem íntegros; se a operação falhar, não mostrar sucesso nem ocultar o item indevidamente. A semântica de exclusão/inativação deve ser coerente entre action, filtros e UI.
6. **Tarefas no card:** a aba Tarefas lista e permite gerir somente tarefas comuns; entradas gerenciadas por procedimento aparecem apenas na aba Procedimento, sem duplicação nem perda de seus dados.
7. **Anexos:** o upload autorizado no card conclui e o arquivo fica disponível após atualizar/reabrir o card. O erro **“Recibos de anexos não configurados”** deve ser diagnosticado e resolvido na configuração/contrato necessário; falhas reais mostram mensagem acionável e não produzem anexo fantasma.
8. **Cadência com passo de zero dias:** ao criar um card em etapa com cadência ativa cujo primeiro passo vence em 0 dias, a tarefa correspondente é gerada sem aguardar movimentação posterior. Ao mover para outra etapa com cadência ativa, o ciclo aplicável também é iniciado e seus passos vencidos são processados. Repetição do evento ou execução concorrente não duplica tarefas; cadência não bloqueia a movimentação do card.
9. **Execução periódica:** verificar `vercel.json`, rota de cron e executor de cadências; a execução operacional pretendida é a cada 5 minutos. Corrigir o agendamento/wiring se a configuração real não atender esse intervalo e registrar a evidência da verificação.
10. **Excluir cadência:** a tela administrativa oferece ação de exclusão com confirmação, autorização e feedback correto. Após sucesso, a cadência não aparece como disponível para novas etapas/cards, inclusive após recarga; vínculos e tarefas históricas mantêm integridade. O comportamento de cadência em uso deve ser explicado no diálogo e coberto por teste.

## Tasks / Subtasks

- [x] Remover o atalho de Base de Conhecimento da página inicial de Configurações e verificar navegação contextual (AC 1).
- [x] Mapear composição publicada, obrigatoriedade e guard de transição; alinhar prévia e comando no servidor; testar obrigatório presente/ausente/opcional (AC 2).
- [x] Retirar “a origem” do escopo conforme resposta do usuário (AC 3).
- [x] Simplificar o painel de Procedimento no card e retirar ação de criação local; implementar exclusão e filtros da listagem administrativa (AC 4–5).
- [x] Separar tarefas comuns de entradas de procedimento nas abas do card, preservando gestão e histórico (AC 6).
- [x] Rastrear o erro de recibos no upload; configurar a chave local e de produção na Vercel e melhorar a mensagem. Teste de upload real pendente do próximo deploy (AC 7).
- [x] Auditar ativação de cadência na criação e movimentação, executor de passo 0 dias, idempotência e cron de cinco minutos; corrigir lacunas. `CRON_SECRET` configurado na Vercel; execução implantada pendente do próximo deploy (AC 8–9).
- [x] Implementar exclusão de cadência com integridade, confirmação e atualização da UI (AC 10).
- [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; registrar resultados reais, checklist e File List final.

## Dev Notes e pontos de integração

- Página inicial de Configurações: `src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx`; o editor de pipeline também possui entrada de Base de Conhecimento em `AdminPipelineClient.tsx`. [Fonte: código atual]
- Formulários e movimento: `src/actions/bpm/FormulariosEtapa.ts`, `src/lib/bpm/formularios-etapa.ts`, `src/lib/bpm/requisitos-etapa-server.ts`, `src/lib/bpm/transicao-command.ts`, `src/actions/bpm/Cards.ts`. A story existente exige publicação atômica das obrigações e guard servidor. [Fonte: `story-alpha-crm-campos-formularios-obrigacoes-por-etapa.md`]
- Procedimentos: `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`, `PainelChecklistsCard.tsx`, `src/components/bpm/checklists/ChecklistsWorkspace.tsx`, `src/actions/bpm/Checklists.ts`. A exclusão anterior reutiliza `ativo=false`; o relato atual mostra que a listagem ainda exibe o item. [Fonte: `story-rm-2026-e96332-exclusao-procedimentos.md`; código atual]
- Tarefas: `PainelHistorico.tsx` já chama `separarTarefasCard`; `PainelTarefasPorTipo.tsx` ainda possui tipo `CHECKLIST` e ação para abrir procedimento. Conferir o fluxo real antes de mudar filtros. [Fonte: código atual]
- Anexos: `src/app/api/bpm/upload/route.ts` retorna 503 com a mensagem relatada quando os recibos não estão configurados. Verificar sua dependência de armazenamento e o consumo no card antes da correção. [Fonte: código atual]
- Cadências: `src/lib/bpm/cadencias/executor.ts`, `src/lib/bpm/cadencias/ativacao-automatica.ts`, `src/actions/bpm/Cadencias.ts`, `src/app/api/bpm/jobs/automacoes/route.ts`, `src/components/bpm/cadencias/CadenciasWorkspace.tsx`, `vercel.json`. O executor já declara chave de idempotência; verificar os gatilhos e o agendamento efetivo. [Fonte: código atual; `story-rm-2026-97cc60-gestao-tarefas-cadencias.md`]
- Alterações de schema, migrations, seeds/backfills ou operações em massa exigem Vault, backup completo verificado e confirmação explícita do usuário antes de executar, conforme `AGENTS.md`. CRUD unitário normal segue o contrato existente. A migração foi executada após autorização explícita do usuário nesta conversa.
- Vault foi consultado. Backup prévio de 24/09/2026 18:13 UTC (`database-backups/pre-change/painelalpha_turso_pre_change_2026-09-24T18-13-27-754Z.sql`) restaurado em banco descartável: SHA-256 `2c488d2988762638abc717f6d6c25d948cd76c93a37ba4e9c343a4eb812a88ba`, 154.030.961 bytes, 331 tabelas, 159.152 linhas, `integrity_check=ok`, nenhuma violação de FK. Nova tentativa de backup falhou por timeout de transação de leitura no Turso, sem mutação. Migração das duas colunas aplicada após autorização, com `foreign_key_check=0`; leitura posterior confirmou 6 procedimentos e 3 cadências preservados, todos com `excluidoEm=NULL`.
- `vercel.json` declara `/api/bpm/jobs/automacoes` em `*/5 * * * *`; a rota chama `processarCadenciasBpm`. A sessão da CLI da Vercel foi renovada e a listagem de produção confirmou `CRM_READ_WRITE_TOKEN`, `CRM_ANEXO_RECEIPT_SECRET` e `CRON_SECRET`. As duas últimas foram adicionadas neste trabalho como segredos, sem expor valores. Também foram configuradas em `.env.local` ignorado pelo Git. Vercel aplica variáveis novas apenas a deployments novos; cron e upload aguardam deploy para verificação operacional.
- `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados nesta árvore na preparação.

## Testing

- Testes de ações/guards com formulário publicado, campos removidos e transição; teste de UI para pendências coerentes.
- Testes do card para abas de Procedimento/Tarefas, exclusão de procedimento com recarga e upload de anexo.
- Testes de cadência para criação de card, entrada por movimento, passo 0 dias, repetição/concorrência, exclusão em uso e cron configurado. Validar `vercel.json` e o executor por comportamento, não somente por texto.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Frontend e integração BPM; secundários API, armazenamento e agendamento; complexidade alta.
- **Specialized Agents:** @dev executor; @ux-design-expert para card/configurações; @qa para testes e regressões; @architect se surgir decisão de contrato; Vault/@data-engineer somente se houver alteração protegida de banco.
- **Quality Gate Tasks:** [ ] Pre-Commit (@dev), revisar diferença e gates; [ ] Pre-PR (@devops), quando houver PR; [ ] Pre-Deployment (@devops), se houver implantação.
- **Self-Healing Configuration:** @dev light, até 2 iterações/15 min, corrige CRITICAL e documenta HIGH; @qa full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; @devops check, somente relatório.
- **Focus Areas:** autorização e integridade dos registros, consistência entre UI e guard servidor, configuração de armazenamento, idempotência de cadências, acessibilidade e feedback de exclusão.

## Checklist

- [x] Pedido consolidado em uma única story com aceites por área.
- [x] Stories e caminhos relevantes identificados, sem presumir solução de banco.
- [x] Usuário orientou pular “a origem”.
- [ ] AC 5, 7 e 10 verificados no ambiente real após próximo deploy, upload e exclusão de teste autenticada.
- [x] Gates executados: lint sem erros (1192 avisos preexistentes); typecheck, 507 arquivos de teste / 3821 testes e build aprovados.
- [x] File List atualizada para esta story.

## File List

- `docs/stories/story-rm-2026-ajustes-integrados-config-card-cadencias.md` — status, escopo, gates e arquivos.
- `prisma/schema.prisma`, `prisma/migrations/20260924210000_bpm_soft_delete_definitions/migration.sql` — coluna opcional de exclusão lógica aplicada no Turso após autorização.
- `src/actions/bpm/Cadencias.ts`, `src/components/bpm/cadencias/CadenciasWorkspace.tsx`, `src/lib/bpm/cadencias/ativacao-automatica.ts`, `src/lib/bpm/cadencias/executor.ts` — exclusão de cadência e execução imediata.
- `src/actions/bpm/Cards.ts`, `src/lib/bpm/transicao-command.ts`, `src/lib/bpm/campos-formulario-publicado.ts`, `src/lib/bpm/formulario-renderer.ts`, `src/lib/bpm/formularios-etapa.ts` — validação pela composição publicada e processamento de cadência no evento.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` — editor da obrigação de componentes e prévia do card.
- `src/actions/bpm/Checklists.ts`, `src/components/bpm/checklists/ChecklistsWorkspace.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx`, `src/lib/bpm/tarefas-card.ts` — procedimentos e tarefas.
- `src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx`, `src/app/api/bpm/upload/route.ts` — atalho e mensagem de anexo.
- `tests/bpm/campos-formulario-publicado.test.ts`, `tests/bpm/cadencias-executor.test.ts`, `tests/bpm/tarefas-card.test.ts`, `tests/bpm/transicao-requisitos-card-react.test.ts` — regressão.

## Validação do rascunho

Checklist `story-draft-checklist.md`: objetivo/contexto, orientação técnica, referências, autonomia, testes e CodeRabbit **PASS** para os AC 1–2 e 4–10; AC 3 **PARTIAL** pela ambiguidade explicitamente aguardando esclarecimento. A implementação independente dos demais critérios pode começar.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-24 | 0.1 | Story única criada a partir do pedido atual. | River (SM) |
