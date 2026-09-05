# RM-2026-8852C2 — Melhoria no layout do card no Kanban

## Status

Ready for Development

## Story

Como administrador do Alpha CRM,
quero configurar quais elementos aparecem no KanbanCard de cada etapa do pipeline, com ordenação e preview,
para que cada etapa exiba a informação mais relevante ao contexto do processo, sem criar componentes paralelos por etapa.

## Contexto e objetivo

**Código do card:** RM-2026-8852C2
**Ideia de origem:** `.ideias/cmtohblgt0016ihtp3zdeho8o/melhoria-kanban-card-crm-bpm-defee4501b6c8ac4.md`

O KanbanCard atual (`PipelineBoardClient.tsx`) usa ramos condicionais hardcoded por etapa (`etapaEhAgendarReuniao`, `etapaEhNovosLeads`, `etapaEhBoasVindas`, `etapaEhAlinhamentoEstrategico`). A ideia anexada pede a substituição desse padrão por um **mesmo componente** com **configuração estruturada por etapa** (`CompactCardViewDefinition` ou equivalente), incluindo:

- Seleção de elementos visíveis (campos do pipeline + componentes nativos);
- Ordenação dos elementos (drag-and-drop preferido);
- Preview ao vivo na tela de configuração;
- Default + override por etapa (ou configuração completa por etapa, sem herança ambígua);
- Read model parametrizado pela configuração efetiva;
- Fallback seguro para etapas sem configuração;
- Respeito a permissões de leitura do usuário;
- Regra inegociável: configuração visual é **presentation layer** — nunca altera domínio.

### Veredito da Fase 0 (auditoria de entregabilidade)

A Fase 0 retornou **AUTO_ADJUSTMENT_REQUIRED**: a ideia exige uma camada de configuração persistida (`BpmEtapaCardViewConfig` ou equivalente) que **não existe em nenhum model do schema**. Isso é uma mudança estrutural que requer fase própria de Vault (backup, migration, validação).

**Lacunas identificadas pela Fase 0:**

| # | Lacuna | Onde |
|---|--------|------|
| 1 | Model `BpmEtapaCardViewConfig` com `pipelineId`, `etapaId`, `itemsJson` | `prisma/schema.prisma` |
| 2 | Seção "Card do Kanban" em `AdminPipelineClient.tsx` | `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/` |
| 3 | Read model parametrizado pela configuração | `src/actions/bpm/Cards.ts` |
| 4 | Renderer do `KanbanCard` que interpreta a configuração | `PipelineBoardClient.tsx` |
| 5 | Preview reutilizando o mesmo renderer | `AdminPipelineClient.tsx` ou sub-componente |

**AUTO_ADJUSTMENT_ACCEPTANCE (Fase 0):**
1. Migration aplicada com model de configuração (validado por Vault, backup verificado).
2. Admin abre `Configurações → Pipeline → Etapa → Card do Kanban`, seleciona/ordena elementos, vê preview, salva.
3. Volta ao board: cards daquela etapa renderizam com a nova composição; outra etapa com configuração diferente renderiza diferente; MESMO componente `KanbanCard`.
4. Etapa sem configuração usa fallback equivalente ao render atual.
5. Usuário sem permissão de campo não vê o campo, mesmo configurado.
6. Nenhum teste de domínio (transição, validação, requirement) é afetado pela configuração visual.
7. 18 testes da ideia passam.

## Escopo funcional exato

### O que a iniciativa entrega (após a fase de Vault)

1. **Modelo de configuração persistida** (`BpmEtapaCardViewConfig` ou equivalente):
   - `pipelineId`, `etapaId`, `itemsJson` (array de `{type, fieldId?, componentKey?, visible, order, options?}`);
   - Suporte a default por pipeline + override por etapa (ou configuração completa por etapa — decisão a ser tomada na Fase 2, sem herança ambígua);
   - A configuração efetiva de uma etapa deve ser **determinística**.

2. **UI de configuração** em `Configurações → Pipeline → Etapa → Card do Kanban`:
   - Seleção de elementos (campos do pipeline por `fieldId`/`fieldKey` + componentes nativos);
   - Ordenação (drag-and-drop preferido, ou equivalente compatível com o design system);
   - Preview ao vivo reutilizando o mesmo renderer do KanbanCard;
   - Aviso quando o número de elementos exceder o limite recomendado.

3. **Catálogo de componentes nativos** (inventariar o que já existe e reutilizar fontes canônicas):
   - Nome/Empresa;
   - Responsável;
   - Pendências (consumir RequirementPolicy canônico — não criar lógica paralela);
   - Checklist (progresso — usar instâncias canônicas);
   - Tarefas pendentes (com destaque de vencidas);
   - Cadência (próxima execução — projetar estado canônico);
   - Próximo contato (com tratamento visual de atraso);
   - SLA;
   - Reunião (data + Meet);
   - Campos do pipeline (resolvidos por `fieldId`/`fieldKey`, não por label).

4. **Read model parametrizado**:
   - `ListarCardsPipelineBpm` (ou nova action) conhece a configuração efetiva das etapas exibidas;
   - Projeta apenas os dados necessários aos componentes configurados;
   - Evita N+1, carregar todos os campos de todos os cards, queries hardcoded por etapa e busca por label.

5. **Renderer parametrizado** (`KanbanCard`):
   - Interpreta `CompactCardViewDefinition` em vez de ramos hardcoded por etapa;
   - Preserva o ramo especial da etapa "Agendar Reunião" (RM-2026-6BEA04) como configuração inicial equivalente;
   - Fallback seguro para etapas sem configuração (equivalente ao render atual);
   - Hierarquia visual: cabeçalho (Nome/Empresa + secundária) → corpo (2–5 informações) → rodapé (responsável/SLA/indicadores);
   - Responsividade: limite de altura, truncamento, sem overflow horizontal.

6. **Permissões**:
   - Mesmo que um elemento esteja configurado, respeitar políticas de leitura do usuário;
   - Campo sem permissão não aparece na projeção (não altera a configuração persistida).

7. **Regra inegociável**:
   - Configuração visual é presentation layer;
   - Nunca altera RequirementPolicy, VisibilityPolicy, EditPolicy, AuthorizationPolicy, TransitionDefinition ou BusinessRule.

### O que permanece igual

- Drag-and-drop de cards entre colunas;
- Abertura do card (modal);
- Estados de loading/error/empty/virtual card;
- Realtime e notificações;
- Todas as ações de domínio (transição, validação, requirement).

## Fora de escopo

- **Schema novo / migration** — exige fase própria de Vault (backup, migration, validação). Esta story registra a necessidade, mas a implementação do model fica para uma fase executora com aprovação de banco.
- Criar componentes paralelos por etapa (`KanbanCardNovosLeads`, `KanbanCardTratativa`, etc.).
- Criar nova lógica de obrigatoriedade, checklist, tarefa ou cadência específica para o Kanban.
- Alterar RequirementPolicy, VisibilityPolicy, EditPolicy, AuthorizationPolicy, TransitionDefinition ou BusinessRule.
- Alterar persistência, modelo ou regras de materialização de Checklist.
- Alterar `CriarInteracaoCardBpm`, autenticação, Zod, ownership, histórico ou realtime.
- Criar API, Server Action, rota, menu, atalho ou permissão novos (além da seção de configuração já existente em `AdminPipelineClient.tsx`).
- Alterar cards virtuais Noloss.
- Remover ou redesenhar o sistema Timeline, `PainelTimelineCard`, `ListarTimelineCardBpm`, extratores ou dados associados.
- Mudar o estado inicial `etapas`.
- **Pendências administrativas não resolvidas** (registrar como pendência, não resolver arbitrariamente):
  - Se "default + override por pipeline" ou "configuração completa por etapa" — decisão a ser tomada na Fase 2 (especificação visual), sem herança ambígua.
  - Limite máximo de elementos por card — definir na Fase 2 com base na análise de responsividade.
  - Se o preview usa dados mockados ou dados reais de um card de exemplo — definir na Fase 2.

## Arquivos a alterar (base no mapa da Fase 0)

| Arquivo | Papel | Alteração esperada |
|---------|-------|--------------------|
| `prisma/schema.prisma` | Model de configuração | **NOVO** — `BpmEtapaCardViewConfig` (ou equivalente) — **exige fase Vault** |
| `prisma/migrations/...` | Migration | **NOVA** — aditiva, validada por Vault |
| `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` | `KanbanCard` | Substituir ramos hardcoded por renderer parametrizado |
| `src/actions/bpm/Cards.ts` → `ListarCardsPipelineBpm` | Read model | Parametrizar pela configuração efetiva; projetar dados necessários |
| `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx` | Shell de configuração | Adicionar seção "Card do Kanban" |
| `src/lib/bpm/checklists/integracao.ts` | Resumo canônico de checklist | Reutilizar (sem alteração) |
| `src/lib/bpm/cadencias/executor.ts` | Estado canônico de cadência | Reutilizar (sem alteração) |
| `src/lib/bpm/sla.ts` | SLA por card | Reutilizar (sem alteração) |
| `src/lib/bpm/requisitos-etapa-server.ts` | RequirementPolicy | Reutilizar (sem alteração) |
| `tests/bpm/` | Testes | Adicionar 18 testes da ideia |

## Critérios de aceite

### AC1 — Configuração por etapa com MESMO componente

Dado um pipeline com duas etapas (A e B) com configurações diferentes,
quando o board renderizar,
então ambas as etapas usam o MESMO componente `KanbanCard`,
com composição visual diferente conforme a configuração de cada etapa.

### AC2 — Seleção de elementos

Dado um administrador na tela `Configurações → Pipeline → Etapa → Card do Kanban`,
quando selecionar/desselecionar elementos (campos do pipeline + componentes nativos),
então a configuração persistida reflete exatamente a seleção,
e o board daquela etapa renderiza somente os elementos selecionados.

### AC3 — Ordenação

Dado um administrador na tela de configuração,
quando reordenar elementos (drag-and-drop ou equivalente),
então a ordem persistida é respeitada no render do card,
e a reordenação altera somente a apresentação, não o domínio.

### AC4 — Preview

Dado um administrador na tela de configuração,
quando habilitar/desabilitar ou reordenar elementos,
então o preview ao vivo reflete a mudança em tempo real,
reutilizando o mesmo renderer do KanbanCard (não uma segunda interpretação).

### AC5 — Campos por identidade estável

Dado um campo do pipeline configurado por `fieldId`/`fieldKey`,
quando o label do campo for renomeado,
então a configuração continua funcionando (não quebra por label).

### AC6 — Rename de etapa não quebra configuração

Dado uma etapa com configuração salva,
quando o nome da etapa for alterado,
então a configuração continua associada à etapa (por `etapaId`, não por nome).

### AC7 — Permissões

Dado um usuário sem permissão de visualização de um campo configurado,
quando o card renderizar,
então o campo não aparece na projeção,
sem alterar a configuração persistida da etapa.

### AC8 — Pendências usam RequirementPolicy canônico

Dado o componente "Pendências" habilitado para uma etapa,
quando o card renderizar,
então as pendências exibidas vêm exclusivamente do resolvedor/policy canônico de Requirement,
sem lógica paralela de obrigatoriedade no KanbanCard.

### AC9 — Checklist usa estado canônico

Dado o componente "Checklist" habilitado,
quando o card renderizar,
então o progresso exibido vem das instâncias canônicas de checklist (`BpmCardChecklist`/`BpmCardChecklistItem`),
sem estado específico para o Kanban.

### AC10 — Tarefas usam estado canônico

Dado o componente "Tarefas pendentes" habilitado,
quando o card renderizar,
então as tarefas exibidas vêm da source of truth existente (`BpmTarefa`),
com destaque de vencidas quando aplicável.

### AC11 — Fallback

Dado uma etapa sem configuração salva,
quando o board renderizar,
então o card usa fallback seguro equivalente ao render atual (Nome/Empresa, Responsável, SLA ou informação operacional básica),
sem quebrar.

### AC12 — Read model eficiente

Dado um board com múltiplas etapas e cards,
quando o read model carregar os dados,
então não ocorre N+1 relevante,
não carrega todos os campos de todos os cards,
e não usa queries específicas hardcoded para cada etapa.

### AC13 — Drag-and-drop do Kanban continua funcionando

Dado um card no board,
quando o usuário arrastar o card para outra coluna,
então a transição ocorre normalmente,
sem interferência da configuração visual.

### AC14 — Abrir o card continua funcionando

Dado um card no board,
quando o usuário clicar para abrir o modal,
então o modal abre normalmente com todos os painéis funcionais,
sem regressão.

### AC15 — Configuração visual não interfere em transições ou validações

Dado qualquer configuração de card,
quando o usuário mover um card entre etapas,
então todas as transições, validações e requirements funcionam normalmente,
sem alteração de comportamento de domínio.

### AC16 — Responsividade

Dado um card com muitos elementos configurados,
quando o board renderizar em viewport limitada,
então o card mantém hierarquia, usa truncamento apropriado,
não aumenta indefinidamente a altura,
e não causa overflow horizontal.

### AC17 — Estados de loading/error/empty/virtual card

Dado um board em estado de loading, erro, vazio ou com cards virtuais,
quando o board renderizar,
então todos os estados continuam funcionando corretamente,
sem regressão introduzida pela configuração visual.

### AC18 — 18 testes da ideia passam

Dado a suíte de testes da iniciativa,
quando `npx vitest run tests/bpm/` for executado,
então os 18 testes listados na ideia (seção 19) passam,
sem falha nova.

## Checklist de execução

- [ ] **Fase 2 — Especificação visual**
  - [ ] Definir se "default + override por pipeline" ou "configuração completa por etapa"
  - [ ] Definir limite máximo de elementos por card
  - [ ] Definir se o preview usa dados mockados ou dados reais
  - [ ] Especificar o contrato exato de `CompactCardViewDefinition`
  - [ ] Especificar o catálogo final de componentes nativos
  - [ ] Especificar a hierarquia visual (cabeçalho/corpo/rodapé)

- [ ] **Fase 3 — Implementação**
  - [ ] Criar model `BpmEtapaCardViewConfig` (exige fase Vault)
  - [ ] Criar migration aditiva (validada por Vault, backup verificado)
  - [ ] Implementar UI de configuração em `AdminPipelineClient.tsx`
  - [ ] Implementar renderer parametrizado em `PipelineBoardClient.tsx`
  - [ ] Parametrizar read model em `ListarCardsPipelineBpm`
  - [ ] Implementar preview reutilizando o mesmo renderer
  - [ ] Implementar fallback seguro
  - [ ] Implementar respeito a permissões
  - [ ] Adicionar 18 testes da ideia
  - [ ] Rodar gates: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`

## File List

_(a ser preenchida pela Fase 3)_

## Notas

- **Artigo IV (Sem Invenção):** Esta story não inventa requisitos fora da ideia anexada. Decisões de produto pendentes (default+override vs. configuração completa, limite de elementos, dados do preview) estão registradas como pendências explícitas, não resolvidas arbitrariamente.
- **Artigo V (Segurança):** A configuração visual é presentation layer. Não altera autenticação, autorização, ownership ou persistência.
- **Artigo VI (Memória):** Esta story deve ser registrada em `.bibble/memory/architecture.md` após a implementação.
- **Artigo VII (Imports absolutos):** Aplicável na implementação (Fase 3), não na redação desta story.
- **Gate de banco:** A criação do model `BpmEtapaCardViewConfig` exige fase própria de Vault (backup, migration, validação). Esta story registra a necessidade, mas a implementação do model fica para uma fase executora com aprovação de banco.
