# RM-2026-2C769C — Remover tipo Relacionamento da criação

## Status
Pronta para testes — implementação preexistente e fixtures revalidadas nesta retomada.

## Escopo e blueprint Scout
Remover apenas a entrada relacionamento de TIPOS_CAMPO em FormularioEtapaWorkspace.
A lista é exclusiva da criação; preservar contratos Zod, actions, Prisma e renderizadores.
Blueprint recebido da Fase 1 e confirmado por inspeção local. Nenhuma mudança de banco.

## Critérios de aceite
- [x] Relacionamento removido apenas da lista local; demais opções e ordem preservadas (leitura final).
- [x] Campo existente continua aplicável à composição e publicável (fixture React).
- [x] Fixture de relacionamento aceita edição/salvamento e respeita somente leitura (React e action com banco mockado).
- [x] Gates executados e limitações registradas.

## Entregabilidade
Administrador: Alpha CRM → Configurações → pipeline →
/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId] → Campos e formulários →
etapa/seção → Criar novo campo → Tipo.
Menu, link, página protegida por sessão/perfil e montagem do workspace inspecionados.
Navegação autenticada em ambiente real não executada.

## File list
- src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx
- tests/bpm/relacionamento-ui.test.ts
- tests/bpm/edicao-campos-card.test.ts
- docs/stories/story-rm-2026-2c769c-remover-tipo-relacionamento.md
- .bibble/memory/components.md
- .bibble/memory/journal.md


## Validação da tentativa anterior
- 12 testes de action passaram, incluindo relacionamento editável com upsert e somente leitura sem escrita, com banco mockado.
- Fixture React criada para composição/publicação, lista de criação, edição e readOnly. Não executada: happy-dom declarado mas ausente em node_modules. Testes React preexistentes também impedidos.
- npm test falhou antes da suíte: EBUSY em coverage. Pasta ocupada preservada.
- npm run lint executado; evidência: .relacionamento-lint.log.
- npm run typecheck: tipagem inicial da fixture corrigida com FormularioEtapaAdmin e comando repetido; evidência: .relacionamento-typecheck-final.log.
- Lint direcionado executado; evidência: .relacionamento-lint-scope.log.
- npm run build executado com limite de 90s; evidência: .relacionamento-build.log. Sem aprovação de build nesta entrega.
- Não houve banco, migration, Git mutável ou alteração de renderizadores.
- Alterações anteriores preservadas; nenhum componente novo.

Autoajuste anterior resolvido: happy-dom disponibilizado e fixtures React aprovadas nesta reexecução.
Aceite do autoajuste: relacionamento-ui.test.ts e pipeline-editor-react.test.ts passaram; suíte global executada com diretório próprio de cobertura, sem EBUSY.
DELIVERY_READY: acesso confirmado no código até o diálogo em /PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]. Fixtures funcionais aprovadas; navegação autenticada real não executada.


## Reexecução Nova — 2026-09-22
- Inspeção confirmou a remoção prévia de uma única opção; nenhuma alteração adicional no código de aplicação ou testes foi necessária. Preservadas as mudanças de outras RMs.
- Ambiente: happy-dom@20.14.5 (versão do lockfile) instalado com scripts desativados em `.roadmap-worker/rm-2026-2c769c-recheck/ui-env`; link local `node_modules/happy-dom`. Manifesto e lockfile não alterados.
- `npx vitest run tests/bpm/relacionamento-ui.test.ts tests/bpm/pipeline-editor-react.test.ts tests/bpm/edicao-campos-card.test.ts`: 3 arquivos, 23 testes passaram. Cobrem composição/publicação mockada, opções e ordem do seletor, renderização/edição, bloqueio de edição, salvamento mockado e estado do editor.
- `npm run typecheck`: PASS (exit 0).
- Lint direcionado do workspace e dos dois testes desta RM: PASS (exit 0).
- `npm run lint`: FAIL, 2.417 erros e 1.218 avisos no working tree compartilhado.
- `npm test -- --coverage.reportsDirectory=.roadmap-worker/rm-2026-2c769c-recheck/coverage`: FAIL, 14 arquivos falharam e 458 passaram; 19 testes falharam, 3.496 passaram e 1 todo. Inclui falhas em notas, Onyx, parceiros e gerador de documentos. Sem o EBUSY da tentativa anterior. Não houve baseline limpo para atribuir causalidade das falhas globais.
- Build não repetido: código de aplicação inalterado nesta reexecução; evidência histórica em `.relacionamento-build.log`, sem nova aprovação de Forge.
- Evidências atuais: `.roadmap-worker/rm-2026-2c769c-recheck/{install,focused,typecheck,lint,lint-scope,test}.log`.
- Caminho reinspecionado: CRMLayoutClient → Configurações → AdminPipelinesListClient → página protegida do pipeline → AdminPipelineClient/aba Campos e formulários → FormularioEtapaWorkspace → Criar novo campo/Tipo. Consumidor: administrador.
- Pendência: gates globais e validação autenticada; não ampliar esta remoção visual para corrigir outros módulos. Nenhuma operação de migration/schema ou Git mutável executada.
- Arquivos documentais atualizados nesta reexecução: esta story, `.bibble/memory/components.md` e `.bibble/memory/journal.md`. Os arquivos de implementação/testes da file list já estavam presentes e foram preservados.

## Retomada terminal 5/10 — 2026-09-22

Nenhum código foi reescrito: remoção e fixtures já estavam no `HEAD` pelo
commit `e51d88c9`. Nesta retomada foram executados 32/32 testes focados em
quatro suítes, ESLint do workspace/fixtures e typecheck, todos aprovados. A
lista sem “Relacionamento”, a composição/publicação de registros existentes e
o bloqueio `somenteLeitura` foram revalidados. Navegação autenticada permanece
para homologação. Resultado: **PASS no escopo**, encaminhado para **Em testes**.
