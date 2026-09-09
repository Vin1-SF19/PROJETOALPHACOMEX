# RM-2026-045CC0 — CRM-STAGE-FORM-MIGRATION (P0-2)

**Status:** Done
**Objetivo:** reconciliar os formulários por etapa com `BpmCampoEtapaConfig`, preservar identidades e referências e impedir nova divergência.
**Base:** `a43c6f64` — P0-1 CRM-CONFIG-CANONICAL-SOURCES.
**Branch:** `feat/crm-stage-form-migration`
**Worktree:** `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/crm-stage-form-migration`

## Critérios de aceite

- [x] Todo componente `CAMPO` mantido possui configuração canônica ativa e visível na respectiva etapa.
- [x] Campo configurado em uma etapa não é herdado automaticamente pelas demais.
- [x] Nenhum componente é removido sem classificação e evidência auditável.
- [x] Casos ambíguos permanecem `REVIEW_REQUIRED` e não são alterados automaticamente.
- [x] Valores e vínculos históricos de cards permanecem intactos.
- [x] `CHECKLIST` preserva o target `STAGE_CHECKLIST` em read → save.
- [x] `CAPABILITY` aceita apenas referências canônicas e válidas para a etapa.
- [x] O salvamento é diferencial, preserva IDs, usa CAS e rejeita IDs externos ao formulário.
- [x] Formulário íntegro salva sem `CAMPO_FORA_FORMULARIO_ETAPA`; erro inválido identifica campo, etapa e motivo.
- [x] Dry-run é o padrão, não escreve, detecta drift e produz plano auditável.
- [x] Apply é transacional, exige confirmação/plano/ambiente explícitos e é idempotente.
- [x] Os 32 formulários e as nove etapas críticas têm evidência antes/depois.
- [x] Testes focados da P0-1 e da P0-2 permanecem verdes.
- [x] Renderer universal, preview real, painéis hardcoded, redesign, drag-and-drop e Draft/PUBLISHED permanecem para P0-3/P0-4.

## Baseline a reconfirmar

Baseline histórico recebido: 32 formulários ativos v1, 1.306 componentes, 1.237 `CAMPO`, 37 `CAPABILITY`, 32 `CHECKLIST`, 1.073 campos incompatíveis e 29 formulários afetados.

Diagnóstico remoto somente leitura após P0-1, em 2026-09-09:

- 32 formulários ativos, todos v1;
- 64 seções e 1.306 componentes;
- 1.237 `CAMPO`, 37 `CAPABILITY` e 32 `CHECKLIST`;
- 1.057 componentes `CAMPO` incompatíveis: 1.043 sem configuração na etapa e 14 com configuração canônica invisível;
- 29 formulários afetados;
- 180 componentes `CAMPO` plenamente válidos;
- nenhum campo órfão, inativo, fora do catálogo ou duplicado no mesmo formulário;
- 202 configurações campo-etapa e 29 compartilhamentos reais após P0-1;
- 3 cards, 22 valores, 2 checklists/6 itens, 29 históricos e nenhum anexo.

A diferença de 16 incompatíveis em relação ao baseline histórico é explicada pelas configurações válidas materializadas na P0-1. Os números completos serão reproduzidos pela CLI versionada.

## Causa raiz comprovada

A migration `20260905143000_bpm_ontologia_canonica` criou um componente para todo campo ativo cujo `pipelineId`, `etapaId` legado ou `BpmCampoPipeline` alcançava o pipeline. Campos sem `etapaId` foram copiados para todas as etapas do pipeline, mesmo sem `BpmCampoEtapaConfig`. Como os 32 formulários continuam na versão 1, não há evidência de edição administrativa posterior que justifique essas cópias. A P0-1 consolidou a aplicabilidade por etapa e reduziu o conjunto incompatível; a composição antiga não foi reconciliada automaticamente.

## Blueprint Scout

### Criar

- [x] `src/lib/bpm/formularios-etapa.ts` — contratos canônicos, allowlists, validação e reconciliação diferencial pura.
- [x] `scripts/bpm-stage-form-migration.mjs` — snapshot, diagnóstico, plano, dry-run, apply e rollback controlado.
- [x] `tests/bpm/formularios-etapa-save.test.ts` — contratos de save, CAS, ownership e referências.
- [x] `tests/bpm/formularios-etapa-migration.test.ts` — classificação, dry-run, drift, idempotência e preservação.
- [x] `docs/reports/crm-stage-form-migration-p0-2.md` — relatório final sanitizado.

### Editar

- [x] `src/actions/bpm/FormulariosEtapa.ts` — trocar replace-all por reconciliação diferencial transacional, validar fonte canônica e CAS.
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — enviar IDs/versão, preservar targets e tratar conflitos/mensagens.
- [x] `package.json` — expor entrada CLI operacional.
- [x] `docs/stories/story-saneamento-ontologico-crm-bpm.md` — registrar avanço da fase de formulário, sem declarar renderer P0-3.
- [x] `.bibble/memory/codebase-map.md`, `.bibble/memory/integration-points.md`, `.bibble/memory/decisions.md` e `.bibble/memory/journal.md` — registrar somente decisões e integração efetivamente entregues.

### Consultar / preservar

- `prisma/schema.prisma` — modelos existentes; nenhuma mudança estrutural prevista.
- `prisma/migrations/20260905143000_bpm_ontologia_canonica/migration.sql` — origem comprovada da expansão indevida.
- `src/lib/bpm/ontology.ts` — registry existente de capabilities.
- `src/actions/bpm/Pipelines.ts` — leitura administrativa já carrega IDs, versão, campos e configurações.
- `src/lib/bpm/transicao-command.ts` — consumidor atual da composição durante transições.
- `src/lib/bpm/ownership.ts` e `src/lib/bpm/realtime-server.ts` — autorização e notificação existentes.
- `database-backups/pre-change/` — snapshot/backup fora do Git e rollback.

### Integrações verificadas

- Navegação existente: CRM → Configurações → pipeline → Formulário por etapa.
- Rota e leitura existentes: `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` → `ObterPipelineBpm`.
- Escrita existente: `FormularioEtapaWorkspace` → `SalvarFormularioEtapaBpm`.
- Runtime atual: `transicao-command.ts` consulta componentes `CAMPO`; renderer universal não existe e fica fora do escopo.
- Permissão: `auth()` + `exigirAcessoConfigPipeline(..., "configurarCampos")`, revalidada dentro da transação.
- Menu/atalhos/rotas/permissões: nenhuma inclusão necessária; o caminho administrativo já existe.

## Classificação planejada

- `A`: criar configuração ausente apenas quando outra evidência específica da etapa comprovar intenção.
- `B`: remover da composição a cópia automática de campo configurado somente em outra etapa.
- `C`: completar compartilhamento apenas quando propriedade/associação e evidência específica da etapa forem inequívocas.
- `D`: remapear somente com mapeamento canônico explícito e preservação de histórico.
- `E`: retirar da apresentação campo inativo, mantendo valores históricos.
- `F`: retirar referência órfã.
- `G`: manter uma identidade determinística e retirar duplicata comprovada.
- `H`: reconciliar componente contrário à configuração canônica existente; a configuração canônica prevalece.
- `I`: `REVIEW_REQUIRED`, sem apply automático.

No estado atual, o diagnóstico preliminar aponta 1.043 itens `B`, 14 itens `H` e zero itens nas demais categorias. A CLI deverá comprovar isso por ID e bloquear caso o estado divirja.

## Tarefas

- [x] Confirmar RM, artefatos, P0-1, isolamento e baseline read-only.
- [x] Produzir blueprint Scout e causa raiz inicial.
- [x] Implementar contratos canônicos e save diferencial com CAS.
- [x] Implementar CLI de snapshot/dry-run/apply/rollback.
- [x] Ajustar prevenção mínima no Form Builder.
- [x] Executar testes de contrato e regressão P0-1.
- [x] Preparar checkpoint Vault e ensaio em cópia restaurada.
- [x] Aplicar somente após backup e aprovação específica.
- [x] Validar todos os formulários, etapas críticas e fingerprints históricos.
- [x] Executar gates finais e consolidar relatório/memória.

## Gates de banco

Nenhuma alteração de schema é prevista. A reconciliação é mutação em massa de configuração e, portanto, exige Vault, backup completo verificado com até 48 horas e confirmação explícita específica antes de qualquer apply em cópia ou banco alvo. Dry-run permanece somente leitura.

## Dev Agent Record

### Agent Model Used

- Codex GPT-5

### Debug Log References

- RM fonte: Painel Alpak, `RM-2026-045CC0`, versão 1, 19 fases publicadas.
- P0-1: `docs/reports/crm-config-canonical-sources-p0-1.md`.

### Completion Notes

- P0-1 confirmada na base `a43c6f64` e no Turso antes da implementação.
- Produção reconciliada: 1.057 incompatíveis para zero, sem casos ambíguos e sem criar configuração campo-etapa artificial.
- 32 checklists, 37 capabilities, 3 cards, 22 valores, 6 itens de checklist e 29 históricos preservados.
- Save replace-all substituído por diff com IDs estáveis, CAS e no-op semântico.
- Backup completo e rollback verificados; ensaio em cópia restaurada incluiu apply, rollback, reaplicação e segunda execução idempotente.
- Build aprovado; lint/typecheck/teste focados aprovados. Baselines globais externos estão discriminados no relatório.

### File List

- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `docs/reports/crm-stage-form-migration-p0-2.md`
- `docs/stories/story-rm-2026-045cc0-crm-stage-form-migration.md`
- `docs/stories/story-saneamento-ontologico-crm-bpm.md`
- `package.json`
- `scripts/bpm-stage-form-migration.mjs`
- `src/actions/bpm/FormulariosEtapa.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- `src/lib/bpm/formularios-etapa-migration.ts`
- `src/lib/bpm/formularios-etapa.ts`
- `tests/bpm/formulario-etapa.test.ts`
- `tests/bpm/formularios-etapa-migration-cli.test.ts`
- `tests/bpm/formularios-etapa-migration.test.ts`
- `tests/bpm/formularios-etapa-save.test.ts`

### Change Log

- 2026-09-09 — story criada a partir da RM documentada; isolamento, P0-1 e baseline remoto confirmados.
- 2026-09-09 — save diferencial, CLI reversível, migração em produção, testes e documentação concluídos.
