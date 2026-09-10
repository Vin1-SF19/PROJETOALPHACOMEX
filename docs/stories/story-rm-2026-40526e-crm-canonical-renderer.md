# RM-2026-40526E — CRM-CANONICAL-RENDERER (P0-3)

**Status:** Done
**Objetivo:** tornar a composição publicada no Form Builder a autoridade visual da etapa no card real e no preview administrativo.
**Base:** `688da908` — P0-2 CRM-STAGE-FORM-MIGRATION.
**Branch:** `feat/crm-canonical-renderer`
**Worktree:** `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/crm-canonical-renderer`

## Pré-requisitos confirmados

- [x] P0-1 está presente: transições, campo-etapa, SLA, cadência e requisitos usam fontes canônicas.
- [x] P0-2 está presente: 32 formulários ativos v2, zero componentes incompatíveis e save diferencial/CAS.
- [x] O banco possui composição determinística para `CAMPO`, `STAGE_CHECKLIST` e as capabilities especializadas atuais.
- [x] Branch e worktree isolados; nenhuma mudança da `main` foi sobrescrita.
- [x] Não há necessidade comprovada de schema, backfill ou mutação em massa nesta task.

## Critérios de aceite

- [x] Um registry canônico descreve targets, props e renderer dos componentes suportados.
- [x] O card resolve o formulário ativo da etapa no servidor e não infere composição por nome/slug.
- [x] `CAMPO` depende exclusivamente de `BpmCampoEtapaConfig` e respeita ordem, visibilidade, obrigatoriedade e edição canônicas.
- [x] O renderer estrutural é compartilhado por card real e preview.
- [x] O preview é inerte e não executa actions, effects ou mutações.
- [x] O builder oferece apenas itens válidos do mesmo registry e preserva os contratos da P0-2.
- [x] Formulário ausente/inativo, campo inválido e target desconhecido geram fallback explícito e observável.
- [x] Renomear pipeline/etapa/campo não altera a seleção de componentes.
- [x] Nenhum painel especializado real é perdido.
- [x] Tarefas, anexos, histórico, SLA, navegação e scripts continuam como shell estrutural global do card.
- [x] Testes focados, lint, typecheck e build do escopo ficam verdes.

## Blueprint Scout

### Criar

- [x] `src/lib/bpm/formulario-renderer.ts` — resolução pura, fail-closed e diagnósticos.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/FormularioEtapaRenderer.tsx` — estrutura compartilhada runtime/preview.
- [x] `tests/bpm/formulario-renderer.test.ts` — contrato, ordem, fallbacks e invariância de labels.
- [x] `docs/reports/crm-canonical-renderer-p0-3.md` — inventário, evidências e riscos.

### Editar

- [x] `src/lib/bpm/formularios-etapa.ts` — registry/catálogo único de componentes.
- [x] `src/lib/bpm/requisitos-etapa-server.ts` — expor chave estável do campo.
- [x] `src/actions/bpm/Cards.ts` — carregar e resolver formulário no mesmo aggregate do card.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx` — delegar ao renderer sem condicionais por label.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` — renderizar subconjunto/ordem da composição e usar flags canônicas.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — remover seleção de layout pelo nome do pipeline.
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — catálogo do registry.
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineWorkspaceSections.tsx` — preview canônico e inerte.
- [x] Testes legados afetados — atualizar para o contrato canônico sem relaxar as asserções.
- [x] Memória AIOX/Bibble — registrar somente integração efetivamente entregue.

## Limites deliberados

- Sem Draft/PUBLISHED, histórico de versões ou workflow editorial da P0-4.
- Sem redesign amplo, drag-and-drop novo ou biblioteca visual paralela.
- Sem converter elementos globais do shell em componentes de etapa sem evidência de variabilidade.
- Sem mutation de banco: se surgir necessidade real, parar no checkpoint Vault antes de executar.

## Dev Agent Record

### Agent Model Used

- Codex GPT-5

### Debug Log References

- RM fonte: Painel Alpak, `RM-2026-40526E`, versão 1, 16 fases publicadas.
- P0-1: `docs/reports/crm-config-canonical-sources-p0-1.md`.
- P0-2: `docs/reports/crm-stage-form-migration-p0-2.md`.

### Completion Notes

- Registry, resolver puro e renderer estrutural compartilhado entregues.
- O card real consome a composição publicada; preview e builder usam o mesmo registry.
- Os sete targets existentes foram preservados e o shell global ficou explicitamente classificado.
- Formulários ausentes/inativos e referências inválidas falham de modo explícito, sem catálogo implícito do pipeline.
- Consulta read-only de produção: 32/32 formulários `READY`, 249 componentes e zero diagnóstico.
- Nenhuma alteração de banco; P0-4 permanece responsável por Draft/PUBLISHED e workflow editorial.
- Relatório completo: `docs/reports/crm-canonical-renderer-p0-3.md`.

### File List

- `.bibble/memory/{architecture,codebase-map,decisions,integration-points,journal}.md`
- `docs/reports/crm-canonical-renderer-p0-3.md`
- `docs/stories/story-rm-2026-40526e-crm-canonical-renderer.md`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/{CardAbertoLayout,CardFullViewModal,CardOpenFormSlot,FormularioEtapaRenderer,PainelCamposEtapaAtual,PainelHistorico,PainelProximaEtapa,PainelRegistrar}.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/pipelines/index.ts` (removido)
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/{AdminPipelineClient,FormularioEtapaWorkspace,PipelineWorkspaceSections}.tsx`
- `src/lib/bpm/{card-modal-ui,formulario-renderer,formularios-etapa,ontology,requisitos-etapa-server}.ts`
- `tests/bpm/{card-modal-integration,formulario-etapa,formulario-renderer,formularios-etapa-save,lost-ui,requisitos-etapa-server,reuniao-transcricao,standby-follow-up}.test.ts`

### Change Log

- 2026-09-09 — story criada após diagnóstico read-only e confirmação de P0-1/P0-2.
- 2026-09-09 — renderer canônico integrado e validado; story concluída sem mutation de banco.
