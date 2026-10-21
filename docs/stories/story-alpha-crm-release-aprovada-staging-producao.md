# Story: Alinhar o CRM do staging e publicar as correções aprovadas em produção

**Status:** Ready for Review

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: [diff-review, vitest, lint, typecheck, build, deploy-smoke]
```

## Story

Como administrador do Painel Alpha, quero que o staging preserve as melhorias já disponíveis em produção, inclusive o bloco Anotações do card aberto, e que as correções aprovadas nesta conversa sejam publicadas nos dois ambientes, para continuar os testes sobre uma versão atualizada e disponibilizar o fluxo aprovado aos usuários.

## Contexto e autorização

Solicitação explícita do usuário: o bloco Anotações, na parte inferior esquerda do card aberto, está desatualizado no staging em comparação à produção; após atualizar o staging, todas as correções desta conversa foram aprovadas para produção. A autorização permanente de commit/push automático em staging continua válida. A publicação em produção está autorizada por esta solicitação, sem necessidade de uma nova confirmação genérica.

Referências de código identificadas pela coordenação: produção real `4ce99fe6` e staging `1ab82aec`. A integração parte de checkout limpo e compara ambas as histórias, preservando o código de produção que não está no staging. O workspace principal contém trabalho paralelo que não integra esta entrega de produção. Staging já recebeu esse pacote em `2d80e4f0`; sua preservação não autoriza promovê-lo.

O usuário criou uma branch atualizada do banco para staging. A falha de login do deployment com snapshot antigo de ambiente já foi resolvida no redeploy informado pela coordenação; o usuário confirmou “deu certo”. Esse contexto torna obrigatório usar as variáveis atuais de cada ambiente ao gerar seus deployments, sem transportar a conexão de staging para produção.

[AUTO-DECISION] Epic numerado/ClickUp → registrar a solicitação direta no caminho de story solicitado pela coordenação, seguindo as stories CRM existentes; não criar requisitos ou itens externos.

## Critérios de aceitação

1. O bloco Anotações do card aberto em staging incorpora a apresentação e as funcionalidades já presentes na produção real, preservando conteúdo, edição, salvamento e permissões existentes. A comparação deve usar o código efetivamente publicado, com evidência dos SHAs de origem.
2. A integração mantém as melhorias existentes em produção nos mesmos caminhos: acesso individual a pipeline e seletor de pipeline, movimentação de cards importados RD, seus formatos de identidade e histórico/autoria. Não substituir arquivos inteiros por uma versão antiga quando isso eliminar funcionalidades de uma das linhas.
3. A versão integrada inclui as correções aprovadas nesta conversa: origem do cliente alinhada a Metas/cadastro e seleção de parceiro; movimentação livre para Admin (TI) e líderes, incluindo o reconhecimento existente de Vitor no operacional, pelo kanban e pelo card; remoção do botão “Abrir CRM independente”; nomes dos vendedores no lugar de IDs; seletor de origem com contraste adequado; anexos e estado amigável de procedimentos ausentes em cards importados; conclusão otimista de tarefas e alertas na central com contexto e horários completos. Não executar alteração cadastral de usuário no banco como parte desta integração.
4. As regras normais de autorização, movimentação e procedimentos continuam preservadas para usuários que não possuem a exceção de liderança/Admin. A conclusão otimista mantém trava contra repetição, reversão em falha e validação no servidor; os alertas mantêm isolamento por usuário e recuperação somente leitura.
5. O escopo publicado contém apenas a integração das linhas de produção/staging e as correções necessárias para preservar os comportamentos aprovados. Alterações sujas ou não relacionadas do workspace principal não são incluídas. Checklist e File List finais refletem os arquivos efetivamente publicados.
6. Não há alteração de schema, migration, seed, backfill, configuração de autenticação, credencial ou mutação em massa. Bancos de staging/produção permanecem distintos; nenhum segredo, dump ou arquivo `.env` é versionado. A integração não executa workers, jobs ou testes que escrevam dados reais.
7. Executar e registrar `npm run lint`, `npm run typecheck`, `npm test` e build completo. A revisão independente verifica os comportamentos dos dois lados da integração e registra o gate de QA. Qualquer falha precisa ser investigada, comparada à base quando pertinente e explicitamente registrada; a publicação não pode ser apresentada como totalmente validada se um gate estiver pendente.
8. Publicar primeiro o staging com o código integrado e as variáveis atuais do ambiente staging, incluindo a conexão da branch de banco recém-atualizada pelo usuário. Verificar o alias `https://staging.alpha-comex.com`, o deployment e sua revisão de fonte; executar smoke somente leitura, incluindo `/api/broadcast` com resposta 200 e acesso ao CRM, sem produzir dados de teste no banco remoto.
9. Após a validação do staging, publicar o código CRM aprovado em produção com as variáveis próprias e atuais de produção. Nunca promover um snapshot de deployment de staging que carregue conexão, autenticação ou outras variáveis de staging para produção. Confirmar alias público de produção, deployment, revisão de fonte equivalente para os caminhos CRM aprovados e smoke somente leitura. O pacote externo Alpha BI/sincronização RD permanece somente no staging, conforme resposta final do usuário.
10. Antes da troca de aliases, identificar os deployments anteriores corretos de cada ambiente e registrar rollback de código/alias, mantendo o ambiente de banco correspondente. Ao concluir, informar as revisões publicadas e evidências reais, distinguindo push de código, build e disponibilidade pública.

## Tasks / Subtasks

- [x] Preparar story, autorização, limites e checklist de draft. (AC: 1–10)
- [x] Registrar a comparação de `4ce99fe6` e `1ab82aec` e a decisão de integração da arquitetura. (AC: 1–6)
- [x] Integrar as melhorias de produção no checkout limpo de staging, com resolução por comportamento nos caminhos compartilhados. (AC: 1–5)
- [x] Conferir cada correção aprovada e as permissões normais/excepcionais com testes existentes e regressões necessárias. (AC: 2–4, 7)
- [x] Confirmar diff sem schema, autenticação, segredos ou arquivos alheios e atualizar File List. (AC: 5–6)
- [x] Rodar lint, typecheck, suíte e build; obter revisão independente de QA e registrar resultados. (AC: 7)
- [ ] Registrar deployments anteriores e rollback; efetuar commit/push por `@devops`. (AC: 5, 10)
- [ ] Construir/publicar staging com seu ambiente atual e validar alias, revisão e smoke somente leitura. (AC: 8, 10)
- [ ] Construir/publicar produção com seu próprio ambiente, após staging validado; verificar alias, revisão equivalente e smoke somente leitura. (AC: 9–10)
- [ ] Atualizar checklist, File List e evidências finais e comunicar o resultado. (AC: 5, 7–10)

## Dev Notes

### Coerência com as entregas existentes

Esta story integra comportamentos existentes e aprovados. Não redesenha o CRM nem cria funcionalidades novas. As stories de referência resumem os contratos a preservar:

- [Anotação fixa](story-alpha-crm-anotacao-fixa-formulario-etapa.md#critérios-de-aceite): disponibilidade no card, salvamento e bloqueio de edição sem permissão. A aparência e a composição final precisam preservar as melhorias adicionais da produção identificadas no diff.
- [Tarefas e notificações](story-alpha-crm-tarefas-otimistas-notificacoes.md#critérios-de-aceitação): conclusão imediata, idempotência, ACL, notificação pessoal com recuperação autenticada e abertura do card correto. O código de `1ab82aec` é a entrega aprovada desses comportamentos.
- [Origem e parceiro](story-alpha-crm-origem-cliente-parceiro.md): catálogo compartilhado e seleção do parceiro.
- [Movimentação excepcional](story-alpha-crm-movimentacao-excepcional-admin-lideres.md): exceção de Admin/liderança com regras normais mantidas para os demais usuários.
- [Anexos e procedimentos](story-alpha-crm-anexos-procedimentos-card.md): leitura correta dos dados importados e distinção entre ausência e falha real.
- As stories de acesso individual, seletor e movimentação RD de produção são referências adicionais; sua presença nos commits reais define o comportamento a preservar, sem reaplicar operações antigas de banco.

### Pontos de integração confirmados

O diff entre as duas revisões inclui `CardAbertoLayout.tsx`, `CardFullViewModal.tsx`, `EditorAnotacaoCard.tsx`, `PainelHistorico.tsx`, `PainelChecklistsCard.tsx`, `PipelineBoardClient.tsx`, `page.tsx`, actions de cards/quadro/tarefas e módulos de autorização/validação. São pontos de revisão, não autorização para substituir toda sua implementação. O plano de resolução deve ser consolidado pela arquitetura antes de editar conflitos. [Source: comparação de arquivos `git diff --name-only 4ce99fe6 1ab82aec -- src tests`]

As novas notificações aprovadas usam a central existente, GET autenticado de alertas e canais privados; a integração com o shell e com o board deve ser mantida. [Source: `story-alpha-crm-tarefas-otimistas-notificacoes.md#dev-agent-record`]

Não existe nova variável prevista. As variáveis de ambiente já existentes devem ser consumidas de seu destino correto; registrar somente nomes/presença quando necessário, nunca os valores. A confirmação da coordenação indica diff vazio em schema/auth/Prisma entre as duas revisões; reconfirmar antes de publicar.

### Segurança de banco e publicação

Publicar código não autoriza alteração estrutural ou de dados. Se surgir necessidade de schema, migration ou mutação em massa, interromper esse trecho e aplicar integralmente Vault, backup completo verificado e confirmação específica prevista no AGENTS.md. Não usar a aprovação desta release como consentimento genérico de banco.

Rollback deve apontar o alias de cada ambiente ao deployment anterior correto daquele ambiente, sem reutilizar o snapshot de variáveis do outro. Como não há migração ou escrita em massa, não há rollback de banco planejado.

### Estrutura e referências ausentes

`accumulated-context.md` foi procurado no workspace e não foi encontrado; a coerência foi baseada nas stories CRM relacionadas e na solicitação atual. `.aiox/gotchas.json` e `.Codex/commands/AIOX/agents/sm.md` não estão presentes; foi usada a persona de `.aiox-core/development/agents/sm.md`. Os documentos gerais `docs/architecture/index.md` e `docs/framework/` também não estão presentes; não há orientação adicional específica nesses artefatos. A arquitetura desta integração está sendo preparada pelo agente responsável e deve ser anexada como evidência na implementação.

## Testing

Utilizar Vitest e testes existentes em `tests/bpm/`, `tests/chamados/` e `tests/comercial/`, com Prisma, actions e realtime simulados. Não chamar jobs/worker reais para verificar alertas.

- Anotações: composição do bloco no card, edição/salvamento e modo somente leitura, incluindo card importado RD.
- Movimentação: Admin/líder no card e kanban, ausência da exceção para usuários normais, IDs RD e preservação dos eventos/histórico/autoria.
- Pipeline: acesso individual, seletor, filtro de equipe e navegação por notificação sem perda de autorização.
- Correções aprovadas: catálogo/parceiro, contraste do seletor, vendedor por nome, ausência do botão removido, anexos e estado vazio de procedimento, tarefa otimista e alertas completos.
- Publicação: revisão de fonte/build e aliases de cada ambiente; `/api/broadcast` 200 como smoke de leitura e acesso público ao CRM. Este smoke não substitui os testes de autorização e comportamento nem autoriza gravação de dados remotos.

Resultados de lint/typecheck/test/build, limitações, gate de QA e comprovantes de deploy deverão ser preenchidos pelo executor. Nenhum resultado de execução é presumido nesta preparação.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type:** Deployment. **Secondary Types:** Integration, Frontend, API, Security. **Complexity:** High, pela reconciliação de duas linhas com melhorias distintas e publicação em ambientes com bancos diferentes.

### Specialized Agent Assignment

`@dev`: integração e revisão pre-commit. `@architect`: preservação de contratos e plano de reconciliação. `@ux-expert`/`@ux-design-expert`: preservação do bloco Anotações e estados de interface. `@qa`: revisão independente de regressões. `@github-devops`/`@devops`: commit/push e publicação com ambiente e rollback corretos.

### Quality Gate Tasks

- [x] Pre-Commit (`@dev`): diff de integração, testes, lint, typecheck e build.
- [ ] Pre-Push (`@devops`): File List, ausência de arquivos alheios/segredos e evidências de QA.
- [ ] Pre-Deployment (`@devops`): ambiente de destino, revisão aprovada, rollback e isolamento das variáveis de staging/produção.
- Pre-PR: N/A; criação de PR não foi solicitada.

### Self-Healing Configuration

`@dev`: light, até 2 iterações/15 minutos, CRITICAL corrigido e HIGH documentado. `@qa`: full, até 3 iterações/30 minutos para CRITICAL/HIGH; MEDIUM como dívida. `@devops`: check, apenas relatório. LOW pode ser ignorado. Caso CodeRabbit não esteja instalado, registrar a indisponibilidade e aplicar o fallback de revisão independente previsto no core-config.

### Focus Areas

Preservação das melhorias nas duas linhas; autorização e identidades RD; concorrência e idempotência; compatibilidade do shell/notificações; ausência de credenciais no diff; seleção correta do ambiente de build; equivalência de código, aliases e rollback.

## File List

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `AGENTS.md`
- `docs/dev-tools.md`
- `docs/reports/staging-sincronizacao-20261020.md`
- `docs/stories/relatorio-alpha-crm-alinhamento-cards-fluxo.md`
- `docs/stories/relatorio-alpha-crm-historico-autoria-rd.md`
- `docs/stories/relatorio-vault-crm-alinhamento.md`
- `docs/stories/relatorio-vault-rd-historico-autoria.md`
- `docs/stories/story-agenda-alpha-operacional-tarefas-status.md`
- `docs/stories/story-alpha-crm-acesso-individual-pipeline.md`
- `docs/stories/story-alpha-crm-alinhamento-cards-fluxo-contrato.md`
- `docs/stories/story-alpha-crm-anexos-procedimentos-card.md`
- `docs/stories/story-alpha-crm-anotacao-fixa-formulario-etapa.md`
- `docs/stories/story-alpha-crm-assessoria-smart-enviar-revisao.md`
- `docs/stories/story-alpha-crm-cadastro-novo-lead-revisao-radar.md`
- `docs/stories/story-alpha-crm-edicao-campos-card.md`
- `docs/stories/story-alpha-crm-integracao-api-painel-alpha.md`
- `docs/stories/story-alpha-crm-membros-por-card.md`
- `docs/stories/story-alpha-crm-migracao-historico-rd-station-v1.md`
- `docs/stories/story-alpha-crm-movimentacao-excepcional-admin-lideres.md`
- `docs/stories/story-alpha-crm-movimentacao-manual-importados-rd.md`
- `docs/stories/story-alpha-crm-origem-cliente-parceiro.md`
- `docs/stories/story-alpha-crm-reconciliacao-historico-autoria-rd.md`
- `docs/stories/story-alpha-crm-recuperacao-campos-sincronizacao-rd-v1.md`
- `docs/stories/story-alpha-crm-release-aprovada-staging-producao.md`
- `docs/stories/story-alpha-crm-revisao-radar-fechado.md`
- `docs/stories/story-alpha-crm-seletor-pipeline-no-quadro.md`
- `docs/stories/story-alpha-crm-tarefas-otimistas-notificacoes.md`
- `docs/stories/story-alpha-crm-tarefas-por-tipo-alerta.md`
- `docs/stories/story-alpha-crm-visao-equipe-pipeline.md`
- `docs/stories/story-central-dev-painel-api-radar.md`
- `docs/stories/story-chamados-multissetorial.md`
- `docs/stories/story-metas-empresa-em-constituicao.md`
- `docs/stories/story-rm-2026-b7694f-mover-checklists-anotacoes-card.md`
- `docs/stories/story-staging-sincronizacao-fluxo-staging-primeiro.md`
- `package.json`
- `scripts/configurar-assessoria-smart-revisao.mts`
- `scripts/configurar-contratacao-em-tratativa.mts`
- `scripts/lib/rd-field-mapping.mjs`
- `scripts/lib/rd-sync-engine.mjs`
- `scripts/lib/rd-sync-plan.mjs`
- `scripts/sincronizar-rd-alpha.mjs`
- `src/actions/ContratoComercial.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Checklists.ts`
- `src/actions/bpm/Dashboard.ts`
- `src/actions/bpm/DisponibilidadeEtapasCard.ts`
- `src/actions/bpm/Empresas.ts`
- `src/actions/bpm/NotaFiscal.ts`
- `src/actions/bpm/Quadro.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/actions/bpm/VisibilidadePipeline.ts`
- `src/actions/chamados.ts`
- `src/app/PainelAlpha/AlphaBI/page.tsx`
- `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/app/PainelAlpha/AlphaCRM/CampoOrigemCliente.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/ConfirmarMovimentoRdModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/EditorAnotacaoCard.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelResumoEtapas.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadePipelineSection.tsx`
- `src/app/PainelAlpha/AlphaCRM/layout.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/SeletorCanalOrigemLead.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/SeletorPipelineBoard.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/origens-lead.ts`
- `src/app/PainelAlpha/Chamados/page.tsx`
- `src/app/api/bpm/tarefas/alertas/route.ts`
- `src/app/api/bpm/upload/direct/route.ts`
- `src/app/api/bpm/upload/finalize/route.ts`
- `src/app/api/integrations/alpha-crm/opportunities/route.ts`
- `src/app/api/pusher/auth/route.ts`
- `src/components/CalendarioAlpha/AgendaSidebar.tsx`
- `src/components/CalendarioAlpha/CalendarioAlphaDashboard.tsx`
- `src/components/CalendarioAlpha/HeaderCalendario.tsx`
- `src/components/DetalhesChamado.tsx`
- `src/components/bpm/kanban/CardKanbanRenderer.tsx`
- `src/components/comercial/ModalGerenciamentoLeads.tsx`
- `src/components/layout/CentralNotificacoesPainel.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/hooks/useBpmCardNotificacaoNavigation.ts`
- `src/hooks/useBpmTarefasNotifications.ts`
- `src/hooks/useConclusaoTarefasBpm.ts`
- `src/lib/bpm/acesso-individual-pipeline.ts`
- `src/lib/bpm/alertas-tarefas.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/automacoes/central-schemas.ts`
- `src/lib/bpm/automacoes/eventos.ts`
- `src/lib/bpm/campos-dinamicos.ts`
- `src/lib/bpm/checklists/schemas.ts`
- `src/lib/bpm/contratacao-em-tratativa-config.ts`
- `src/lib/bpm/lideranca-setor.ts`
- `src/lib/bpm/movimento-importado-rd.ts`
- `src/lib/bpm/notificacoes-tarefas.ts`
- `src/lib/bpm/origem-cliente-server.ts`
- `src/lib/bpm/origem-cliente.ts`
- `src/lib/bpm/ownership.ts`
- `src/lib/bpm/referencia-usuario-campo.ts`
- `src/lib/bpm/requisitos-etapa-server.ts`
- `src/lib/bpm/requisitos-etapa.ts`
- `src/lib/bpm/resumo-contratacao-server.ts`
- `src/lib/bpm/transicao-command.ts`
- `src/lib/bpm/usuarios-campos-server.ts`
- `src/lib/bpm/usuarios-campos.ts`
- `src/lib/bpm/visao-equipe-server.ts`
- `src/lib/bpm/visao-equipe.ts`
- `src/lib/chamados/acesso.ts`
- `src/lib/chamados/conclusao.ts`
- `src/lib/comercial/canais-origem.ts`
- `src/lib/comercial/origens-lead.ts`
- `src/lib/modulos-registry.ts`
- `src/lib/validations/bpm.ts`
- `src/store/useBpmTarefasNotificacoes.ts`
- `tests/bpm/acesso-individual-pipeline.test.ts`
- `tests/bpm/anexos-aba-card-react.test.ts`
- `tests/bpm/anexos-idempotencia.test.ts`
- `tests/bpm/arquivados-action.test.ts`
- `tests/bpm/arquivamento-modal-react.test.ts`
- `tests/bpm/board-visao-equipe-react.test.ts`
- `tests/bpm/boas-vindas-acesso.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/card-rd-tarefas-anotacoes.test.ts`
- `tests/bpm/cards-no-quadro.test.ts`
- `tests/bpm/consulta-colegas-side-effects.test.ts`
- `tests/bpm/contratacao-em-tratativa-config.test.ts`
- `tests/bpm/criar-card-nova-empresa.test.ts`
- `tests/bpm/disponibilidade-etapas-card.test.ts`
- `tests/bpm/edicao-campos-card.test.ts`
- `tests/bpm/em-tratativa.test.ts`
- `tests/bpm/eventos-rd-sqlite.test.ts`
- `tests/bpm/filtro-responsavel-board.test.ts`
- `tests/bpm/lideranca-setor.test.ts`
- `tests/bpm/listar-pipelines-seletor.test.ts`
- `tests/bpm/membros-card-ownership.test.ts`
- `tests/bpm/membros-card-ui.test.ts`
- `tests/bpm/movimentacao-importados-rd-actions.test.ts`
- `tests/bpm/movimentacao-importados-rd-command.test.ts`
- `tests/bpm/movimentacao-importados-rd-react.test.ts`
- `tests/bpm/movimentacao-rd-eventos-reais.test.ts`
- `tests/bpm/movimento-livre-command.test.ts`
- `tests/bpm/movimento-livre-eventos.test.ts`
- `tests/bpm/movimento-livre-react.test.ts`
- `tests/bpm/novo-card-modal-react.test.ts`
- `tests/bpm/oportunidades-integracao-permissoes.test.ts`
- `tests/bpm/origem-cliente-react.test.ts`
- `tests/bpm/origem-cliente.test.ts`
- `tests/bpm/ownership-security.test.ts`
- `tests/bpm/pendencias-motor.test.ts`
- `tests/bpm/pipeline-page-seletor.test.ts`
- `tests/bpm/procedimentos-cards-rd.test.ts`
- `tests/bpm/procedimentos-vazio-react.test.ts`
- `tests/bpm/quadro-actions.test.ts`
- `tests/bpm/rd-field-mapping.test.ts`
- `tests/bpm/rd-sync-collection.test.ts`
- `tests/bpm/rd-sync-engine.test.ts`
- `tests/bpm/rd-sync-plan.test.ts`
- `tests/bpm/relacionamento-ui.test.ts`
- `tests/bpm/requisitos-etapa-server.test.ts`
- `tests/bpm/requisitos-transicao-destino-visibilidade.test.ts`
- `tests/bpm/resumo-contratacao-vendedor.test.ts`
- `tests/bpm/seletor-pipeline-pendente-react.test.ts`
- `tests/bpm/tarefas-alertas-api.test.ts`
- `tests/bpm/tarefas-alertas-central-runtime.test.ts`
- `tests/bpm/tarefas-checklist-actions.test.ts`
- `tests/bpm/tarefas-conclusao-otimista-react.test.ts`
- `tests/bpm/tarefas-notificacoes-board-react.test.ts`
- `tests/bpm/tarefas-notificacoes-hook-react.test.ts`
- `tests/bpm/tarefas-notificacoes-navegacao-react.test.ts`
- `tests/bpm/tarefas-notificacoes-pusher.test.ts`
- `tests/bpm/tarefas-notificacoes-store.test.ts`
- `tests/bpm/tarefas-tipo-actions.test.ts`
- `tests/bpm/tarefas-tipo.test.ts`
- `tests/bpm/upload-direto-privado.test.ts`
- `tests/bpm/usuarios-campos.test.ts`
- `tests/bpm/visao-equipe-config-react.test.ts`
- `tests/bpm/visao-equipe.test.ts`
- `tests/bpm/visibilidade-etapa.test.ts`
- `tests/bpm/visibilidade-pipeline-actions.test.ts`
- `tests/builder/embed.test.ts`
- `tests/chamados/assumir-administrativo-react.test.ts`
- `tests/chamados/assumir.test.ts`
- `tests/chamados/central-notificacoes-painel.test.ts`
- `tests/chamados/conclusao-feedback.test.ts`
- `tests/chamados/multissetorial-acesso.test.ts`
- `tests/comercial/canais-origem.test.ts`
- `tests/comercial/criar-contrato.test.ts`
- `tests/metas/empresa-em-constituicao-react.test.ts`

## Validação da story-draft-checklist

**Resultado:** READY, clareza 9/10. A publicação depende de evidências técnicas previstas nesta story, não de esclarecimento funcional ou nova confirmação de release.

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Solicitação, versões, autorização e relação com stories existentes resumidas. |
| Orientação técnica | PASS | Pontos de conflito, comportamentos, ambientes, limites e rollback definidos. |
| Referências | PASS | Stories acessíveis, contexto resumido e diff de arquivos explicitado. |
| Autossuficiência | PASS | ACs incluem melhorias dos dois lados, política de banco, erros e exclusões de escopo. |
| Testes | PASS | Cenários por integração, gates e smoke de leitura verificáveis. |
| CodeRabbit | PASS | Tipos, agentes, gates, self-healing e fallback presentes. |

Perspectiva do desenvolvedor: a story fornece contexto para iniciar a integração; confirmar os conflitos concretos e os deployments é trabalho de implementação/publicação já identificado. Nenhum requisito novo foi inferido de uma preferência visual vaga.

## Dev Agent Record


### Integração implementada

- Candidato isolado: merge de staging `1ab82aec` e produção `4ce99fe6`, ancestral comum `44a84fe6`. Foram reconciliados 15 arquivos de código, dois testes e cinco documentos, por funcionalidade.
- `EditorAnotacaoCard.tsx` é idêntico à produção; o bloco de Anotações conserva seu visual e comportamento já aprovados.
- Movimento livre tem precedência para Admin/TI/liderança inclusive RD; usuários comuns preservam confirmação de pendências RD. Acesso individual ao pipeline não concede liderança. Mantidos CAS, auditoria, validação de dados submetidos e supressão de automações no reposicionamento livre.
- Fonte de origem única, com catálogo compartilhado. O cadastro mantém a personalização de canais de produção e a seleção de parceiro da correção, em seletor nativo escuro; demais formulários mantêm o seletor Radix escuro. Radar permanece opcional no cadastro de Novo Lead, conforme produção.
- Referências automáticas de usuário continuam somente leitura e consultam nomes históricos sem exigir conta ativa. Seleções de usuários editáveis mostram nomes. A integração evita consultas duplicadas e preserva IDs canônicos.
- Preservados seletor de pipeline, permissões individuais, autoria/histórico RD e todas as correções aprovadas de staging: origem/parceiro, movimento administrativo, retirada do atalho independente, vendedor nominal, anexos/procedimentos e tarefas/alertas.
- Cinco arquivos existentes no workspace principal foram usados somente como referência de integração após revisão integral do diff contra produção. Regressões ali presentes (radar obrigatório, guarda de visibilidade de destino e limpeza de substatus administrativo) foram corrigidas no candidato. Nenhuma coleta ampla das alterações sujas foi realizada.
- Nenhuma modificação em schema, autenticação, dependências, segredos ou configuração de banco. A comparação desses contratos com ambos os pais permanece vazia. Nenhum job, migration ou alteração de dados é necessário.

### Validação concluída do candidato de produção R

Primeira suíte detectou conflitos de comportamento na integração; foram corrigidos antes da publicação. Rodadas direcionadas confirmaram nomes automáticos, seleção de usuários, cadastro, personalização de canal e indicação de parceiro. Lint aprovado (zero erros, 1193 avisos existentes); typecheck aprovado; suíte completa aprovada (674 arquivos, 5058 testes, quatro skipped e um todo); build aprovado (exit 0, 143,6 segundos). Logs: `/var/tmp/alpha-release-lint-final.log`, `/var/tmp/alpha-release-typecheck-final.log`, `/var/tmp/alpha-release-suite-pass.log`, `/var/tmp/alpha-release-build.log` e `/var/tmp/alpha-release-build-result.json`. Fixtures SQLite usaram diretório privado em `/dev/shm` após confirmar lentidão do volume temporário; nenhuma asserção ou timeout foi relaxado.

Preflight inicial DevOps: `main` remoto `1504a1c6` é ancestral da produção `4ce99fe6`. Produção atual: `dpl_6w5Pbv2Jw3VM72gmtB7LkpAuq6hz`; staging com conexão atualizada: `dpl_6zD8Z5skFJMjUbzcXu8PDGdoKJSk`. Durante a validação, staging avançou externamente para `2d80e4f0`, incluindo pacote Alpha BI/scripts RD. Não será realizado force push nem descarte desse avanço; sua incorporação e o limite da aprovação de produção precisam ser documentados antes da publicação. O candidato CRM permanece congelado com os gates acima. Os ambientes sempre terão builds próprios com suas variáveis atuais.


## QA Results

**APPROVED**, revisão independente de `@qa`, limitada ao diff de código/testes SHA-256 `b056d1f046e412913be4b95682afcdc41bf19a93d78b4062045a8b12882df052`. Nenhum achado bloqueante na integração, permissões ou testes. Anotações idênticas à produção; sem delta de schema/autenticação/dependências. CodeRabbit indisponível; aplicado fallback de revisão independente. A aprovação não cobre alterações externas posteriores nem substitui os smokes de cada deployment.

## Release Record

Registrar revisão/commit integrado, resultados, deployments e aliases de staging/produção, ambiente correto de build, smoke de leitura e os deployments de rollback. Não registrar credenciais nem conteúdo de banco.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-20 | 1.0 | Preparação da integração e release explicitamente aprovada; checklist de draft executada. | River / SM |

### Preservação do avanço externo em staging

O usuário solicitou refazer a pergunta sobre o pacote externo e confirmou ao final: **“Publicar somente as correções do CRM desta conversa”**. Essa resposta final substitui a seleção anterior. Produção recebe apenas `R=434443fc82bedd31a666bd55701e15d432626d40`, merge aprovado de `1ab82aec`/`4ce99fe6`. Staging recebe `S`, merge de `2d80e4f0` com R. Nenhum force push. Alpha BI, registro do módulo, scripts RD e seu comando npm permanecem somente em S. A diferença dos caminhos runtime CRM R→S é apenas a limpeza de `cardAbertoPorAlertaRef` ao fechar, já existente em 2d80; todas as correções aprovadas são equivalentes. Os testes adicionais de movimentação RD de 2d80 são preservados em S.

O deployment anterior de staging `dpl_FXxXhhByQ5g4wppqZd4ZTTpQjvo4` (2d80) foi validado READY e `/api/broadcast` 200 em 2026-10-20 às 20:54 UTC; é rollback preferencial de S. Produção anterior permanece `dpl_6w5Pbv2Jw3VM72gmtB7LkpAuq6hz`. R possui seus próprios gates aprovados; S repete os gates no ambiente staging antes de sua publicação. Nunca promover o runtime S para produção.

Evidência operacional pós-publicação será registrada fora do Git em `/var/tmp/alpha-crm-release-publicacao-20261020.json`, sem segredos. O checklist de deployment permanece pendente até a confirmação efetiva dos aliases e smokes.

Avanço adicional `b79a1382` inclui somente três documentos de publicação/configuração de staging; será incorporado após o merge de S, antes de um único push final. Os arquivos runtime/testes não mudam com esse avanço. A File List desta cópia staging inclui os artefatos preservados do pacote externo, que não pertencem ao commit R de produção.

### Gates finais do staging integrado S

- `npm run lint`: aprovado, zero erros e 1193 avisos herdados (`/var/tmp/alpha-stage-release-lint.log`).
- `npm run typecheck`: aprovado (`/var/tmp/alpha-stage-release-typecheck.log`).
- `npm test -- --maxWorkers=2`: aprovado, 678 arquivos/5147 testes; quatro skipped e um todo (`/var/tmp/alpha-stage-release-tests.log`). Fixtures locais privadas em tmpfs; nenhuma escrita em banco remoto.
- Build completo aprovado: exit 0, 166,02 segundos (`/var/tmp/alpha-stage-release-build.log`, `/var/tmp/alpha-stage-release-build-result.json`). Executadas geração do player e build Next webpack com controle de memória; Prisma já gerado, contratos idênticos. A alteração automática de tsconfig foi restaurada e não integra o commit.
- Diff de schema/auth/lockfile/Prisma/Vercel vazio; sem conflitos ou whitespace inválido. Os artefatos extras de staging não integram R.

QA independente S: **APPROVED**, sem achados bloqueantes; integração staging e isolamento de R confirmados após os quatro gates finais. Fonte R permanece com fingerprint previamente aprovado. Smokes remotos são etapa de publicação pendente, não presumida nesta revisão.
