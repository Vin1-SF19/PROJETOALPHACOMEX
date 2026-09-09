# P0-3 — CRM-CANONICAL-RENDERER

**RM:** RM-2026-40526E
**Data:** 2026-09-09
**Branch isolada:** `feat/crm-canonical-renderer`
**Base:** `688da908` — P0-2 CRM-STAGE-FORM-MIGRATION
**Resultado:** PASS no escopo; nenhuma alteração ou migração de banco foi necessária.

## Pré-requisitos e diagnóstico

- P0-1 está presente na base (`a43c6f64`) e mantém `BpmCampoEtapaConfig` como fonte de campo-etapa.
- P0-2 está presente (`688da908`) e a leitura de produção confirmou 32 formulários ativos, 249 componentes e zero componente incompatível.
- A composição já persistida era suficiente para a P0-3: 180 `CAMPO`, 32 `CHECKLIST` e 37 `CAPABILITY`; todos os 32 formulários resolveram como `READY`.
- Não houve modificação de schema, seed, backfill ou dado operacional. Resultado do checkpoint: `DATABASE_CHANGE_NOT_REQUIRED`.

## Causa raiz

O Form Builder persistia `BpmEtapaFormulario`, mas o card real não consumia essa composição. `CardOpenFormSlot` escolhia painéis especializados por predicados baseados no nome da etapa; `CardFullViewModal` consultava um seletor de layout pelo nome do pipeline; e o preview administrativo montava uma lista independente dos primeiros seis campos visíveis. Assim, builder, preview e runtime tinham três contratos visuais diferentes.

## Contrato canônico final

`BPM_FORM_COMPONENT_REGISTRY`, em `src/lib/bpm/formularios-etapa.ts`, é o catálogo único para persistência, builder, resolver, preview e runtime.

| Target estável | Tipo | Renderer |
|---|---|---|
| `STAGE_CHECKLIST` | `CHECKLIST` | `stage-checklist` |
| `MEETING_SCHEDULER` | `CAPABILITY` | `meeting-scheduler` |
| `MEETING_TRANSCRIPT` | `CAPABILITY` | `meeting-transcript` |
| `FOLLOW_UP_SCHEDULER` | `CAPABILITY` | `follow-up-scheduler` |
| `FOLLOW_UP_CHECKLIST` | `CAPABILITY` | `follow-up-checklist` |
| `STANDBY_FOLLOW_UP` | `CAPABILITY` | `standby-follow-up` |
| `COMMERCIAL_POST_CLOSING` | `CAPABILITY` | `commercial-post-closing` |

Campos usam o renderer `field` e só são válidos quando o ID pertence ao conjunto derivado de `BpmCampoEtapaConfig` ativa/visível. Restrições de acesso por perfil ocultam o campo para o usuário sem transformar uma composição canônica válida em diagnóstico estrutural.

`BPM_CARD_SHELL_REGISTRY` documenta os elementos fixos do card — tarefas, anexos, histórico, timeline, cadências, SLA, navegação de etapa e scripts. Eles permanecem fora da composição por etapa porque são estrutura global, não variação do formulário.

## Fluxo entregue

```text
BpmEtapaFormulario + BpmCampoEtapaConfig
  -> ObterCardBpm (aggregate autorizado)
  -> resolverFormularioEtapa (árvore ordenada e fail-closed)
  -> FormularioEtapaRenderer
       -> bindings runtime: painéis reais existentes
       -> bindings preview: representação inerte
```

- O card carrega formulário, seções e componentes no mesmo aggregate autenticado de `ObterCardBpm`.
- O resolver puro valida tipo, target e `configJson`, preserva a ordem e produz diagnósticos sem inferir pipeline/etapa por label.
- O renderer estrutural é o mesmo no card e no preview.
- O builder deriva o catálogo especializado do registry e filtra capabilities pela configuração canônica da etapa.
- O save da P0-2 continua diferencial, com IDs estáveis, Zod, validação de ownership/aplicabilidade, CAS, auditoria e transação.

## Painéis preservados

Todos os painéis reais existentes foram ligados aos targets estáveis: campos dinâmicos, checklist da etapa, agendamento e transcrição de reunião, próximo contato, checklist de follow-up, standby e pós-fechamento comercial. O estado do checklist de follow-up voltou ao modal pelo caminho correto, mantendo o bloqueio de fechamento sem consultar o nome da etapa.

O componente `STAGE_CHECKLIST` no formulário é um acionador explícito para a única montagem real do checklist no painel esquerdo. A aba e o listener só existem quando o formulário resolvido contém esse target, evitando montagem duplicada.

## Fallbacks e observabilidade

- Formulário ausente ou inativo: mensagem explícita; nenhum fallback para “todos os campos do pipeline”.
- Campo fora da etapa: placeholder inválido e diagnóstico `CAMPO_FORA_ETAPA`.
- Target desconhecido, tipo incompatível ou configuração fora do schema: item isolado, diagnóstico específico e nenhuma execução arbitrária.
- Os logs do aggregate registram apenas IDs técnicos e códigos de diagnóstico; não incluem valores de campos.
- Labels continuam sendo exibidos, mas não controlam a escolha de renderer.

## Prova em produção, somente leitura

| Pipeline | Formulários | `READY` | Componentes | Diagnósticos |
|---|---:|---:|---:|---:|
| Revisão de Radar | 9 | 9 | 52 | 0 |
| Financeiro | 7 | 7 | 89 | 0 |
| Radar | 3 | 3 | 6 | 0 |
| Operacional | 13 | 13 | 102 | 0 |
| **Total** | **32** | **32** | **249** | **0** |

Os 32 formulários têm no máximo um bloco contíguo de campos no estado atual. O renderer aceita vários blocos e gera IDs de instância distintos para evitar colisão de DOM.

## Prova de remoção de hardcodes visuais

- `CardOpenFormSlot` não contém `etapaEh*`, `card.etapa.nome` nem seleção por nome/slug; despacha somente por `rendererId` resolvido pelo registry.
- `CardFullViewModal` não consulta mais layout pelo nome do pipeline.
- O antigo `CardModal/pipelines/index.ts`, cujo registry vazio normalizava o nome do pipeline, foi removido.
- Lost e alinhamento usam `BPM_STAGE_KEYS`/`BPM_FIELD_KEYS`; regra de somente leitura financeira usa flags canônicas do campo.
- Ocorrências restantes de `etapaEh*` em `Cards.ts` pertencem a validações e efeitos de domínio preexistentes de movimento, Lost, financeiro e automações. Não escolhem composição visual e, portanto, não são substitutos do renderer.
- Ocorrências restantes de `.nome` nos componentes do modal são labels, mensagens e títulos apresentados ao usuário.

## Performance

- Formulário/seções/componentes entram no aggregate já existente do card; não há consulta por componente ou seção.
- Campos estáticos são carregados uma vez e reutilizados na resolução dinâmica, sem N+1.
- Contatos para agendamento de reunião só são consultados quando o formulário resolvido contém `MEETING_SCHEDULER`, com limite de 101 registros e fail-closed em excesso.
- Campos condicionais continuam avaliados no carregador canônico; campo oculto permanece estruturalmente válido e não é renderizado.

## Segurança e integração

- `ObterCardBpm` preserva o gate de visualização do card antes do aggregate.
- A página administrativa exige sessão e papel administrativo; `SalvarFormularioEtapaBpm` repete autenticação, autorização e ownership dentro da transação.
- Payloads e `configJson` passam por schemas estritos; targets arbitrários, troca de identidade e capability fora da etapa são recusados.
- Não foi introduzido HTML dinâmico, `eval`, SQL cru, segredo, endpoint ou chamada externa.
- Smoke HTTP sem sessão confirmou redirecionamento `307` tanto no CRM quanto na rota administrativa, sem exposição da tela protegida.

## Testes e gates

- Testes focados finais do renderer, formulário, campo-etapa, card modal, Lost, reunião, standby, alinhamento e save: 114/114.
- Regressão focada P0-1: 38/38.
- Suíte BPM ampla: 863/869; seis falhas basais fora do delta (`membros-card-ui`, `fechado-ui`, `criar-card-nova-empresa`).
- Suíte global: 2.671/2.700 aprovados, 28 falhas e 1 `todo`; falhas preexistentes em módulos externos e nos três contratos BPM basais acima.
- ESLint direcionado: zero erro; warnings existentes em arquivos grandes tocados, sem warning novo.
- ESLint global: baseline de 2.482 erros e 1.252 warnings fora do escopo.
- Typecheck direcionado: zero diagnóstico nos arquivos da task; o typecheck global permanece com 20 erros preexistentes em módulos externos.
- Build Next.js de produção: aprovado.
- `git diff --check`: aprovado.
- CodeRabbit CLI: não instalado no ambiente (`coderabbit` ausente do `PATH` e de `~/.local/bin`); revisão manual Lens/Anubis executada.

## Itens deliberadamente deixados para P0-4

- Draft/PUBLISHED e workflow editorial de publicação.
- Histórico/revisão completa de versões de formulário.
- Redesign do builder, drag-and-drop avançado ou biblioteca visual nova.
- Migração dos hardcodes de domínio de movimento/automação, que não participam da composição visual desta P0-3.

## Git

A task permanece isolada na branch `feat/crm-canonical-renderer`; não houve push ou merge.

### `git diff --stat`

`33 files changed, 1.583 insertions(+), 260 deletions(-)`

### `git status --short`

```text
M  .bibble/memory/architecture.md
M  .bibble/memory/codebase-map.md
M  .bibble/memory/decisions.md
M  .bibble/memory/integration-points.md
M  .bibble/memory/journal.md
A  docs/reports/crm-canonical-renderer-p0-3.md
A  docs/stories/story-rm-2026-40526e-crm-canonical-renderer.md
M  src/actions/bpm/Cards.ts
M  src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx
M  src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx
M  src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx
A  src/app/PainelAlpha/AlphaCRM/CardModal/FormularioEtapaRenderer.tsx
M  src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx
M  src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx
M  src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx
M  src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx
D  src/app/PainelAlpha/AlphaCRM/CardModal/pipelines/index.ts
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineWorkspaceSections.tsx
M  src/lib/bpm/card-modal-ui.ts
A  src/lib/bpm/formulario-renderer.ts
M  src/lib/bpm/formularios-etapa.ts
M  src/lib/bpm/ontology.ts
M  src/lib/bpm/requisitos-etapa-server.ts
M  tests/bpm/card-modal-integration.test.ts
M  tests/bpm/formulario-etapa.test.ts
A  tests/bpm/formulario-renderer.test.ts
M  tests/bpm/formularios-etapa-save.test.ts
M  tests/bpm/lost-ui.test.ts
M  tests/bpm/requisitos-etapa-server.test.ts
M  tests/bpm/reuniao-transcricao.test.ts
M  tests/bpm/standby-follow-up.test.ts
```
