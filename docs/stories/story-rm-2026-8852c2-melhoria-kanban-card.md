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

## Especificação Visual

### Evidências e decisões fechadas para a Fase 3

A especificação abaixo deriva da ideia de origem, do inventário da Fase 0 e da implementação atual. A pasta da ideia foi reinspecionada e contém somente o Markdown `melhoria-kanban-card-crm-bpm-defee4501b6c8ac4.md`; não há imagem anexa a interpretar.

As três ambiguidades registradas na Fase 1 ficam resolvidas assim:

1. **Configuração completa por etapa, sem herança.** Cada etapa salva uma lista completa e determinística. Não haverá merge entre default do pipeline e override da etapa nesta primeira versão. A alternativa é permitida pela própria ideia e evita estados difíceis de explicar no editor. Uma etapa sem registro usa o fallback imutável descrito abaixo; ao salvar pela primeira vez, passa a usar integralmente sua configuração.
2. **Máximo de cinco itens configuráveis no corpo.** Nome/Empresa ocupa o cabeçalho e não entra nessa conta; Responsável e SLA, quando habilitados, ocupam o rodapé e também não entram. O editor impede habilitar um sexto item de corpo e exibe aviso textual, em vez de salvar algo que o card precisaria ocultar silenciosamente.
3. **Preview com dados demonstrativos locais.** O preview não consulta um card real, não expõe dados do cliente e não exige uma segunda autorização. Os exemplos são estáveis e cobrem valor presente, ausente e atrasado. O renderer é o mesmo do board; apenas o DTO de entrada muda para um fixture tipado de preview.

Nome/Empresa permanece visível e fixo no cabeçalho. Essa é a identidade mínima do `BpmCard`, preserva escaneabilidade e garante que o card continue compreensível mesmo se todos os itens opcionais forem desabilitados. No editor, o item aparece marcado e bloqueado, com a explicação “Identificação obrigatória do card”.

### Contrato visual e estrutural

O renderer deve receber uma definição estruturada, versionada e sem JSX, HTML ou nome arbitrário de componente. O contrato esperado para a implementação é uma união discriminada equivalente a:

```ts
type CompactCardComponentKey =
  | "COMPANY_NAME"
  | "RESPONSIBLE"
  | "PENDING_REQUIREMENTS"
  | "CHECKLIST_PROGRESS"
  | "PENDING_TASKS"
  | "CADENCE_NEXT_RUN"
  | "NEXT_CONTACT"
  | "SLA_STATUS"
  | "MEETING_DATETIME"
  | "GOOGLE_MEET_ACTION";

type CompactCardItem =
  | {
      kind: "COMPONENT";
      componentKey: CompactCardComponentKey;
      visible: boolean;
      order: number;
    }
  | {
      kind: "FIELD";
      fieldId: string;
      fieldKey: string;
      visible: boolean;
      order: number;
    };

interface CompactCardViewDefinition {
  version: 1;
  pipelineId: string;
  etapaId: string;
  items: CompactCardItem[];
}
```

`order` é único e crescente dentro da lista efetiva. `FIELD` exige identidade estável (`fieldId` e `fieldKey`) e nunca usa label como chave. `COMPONENT` aceita somente a allowlist acima. `options` não será aberto na v1: nenhuma necessidade visual validada nesta fase exige opções livres, e omiti-las evita um contrato arbitrário. O servidor continua responsável por remover da projeção qualquer campo que o usuário não possa ler.

### Catálogo final e zona de render

| Elemento | Zona | Representação compacta | Fonte já existente |
|---|---|---|---|
| Nome/Empresa | Cabeçalho, obrigatório | Inicial + razão social/nome fantasia, até 2 linhas | `BpmCard.empresa`, já retornado pelo board |
| Campo do pipeline | Corpo | Label curta + valor, ambos truncados em 1 linha | `BpmCampo`/`BpmCardCampoValor`, por `fieldId`/`fieldKey` |
| Pendências | Corpo | Ícone + `Pendências: N`; zero vira `Sem pendências` | RequirementPolicy em `requisitos-etapa-server.ts` |
| Checklist | Corpo | Ícone + `Checklist X/Y`, com números tabulares | Resumo canônico em `checklists/integracao.ts` |
| Tarefas pendentes | Corpo | `Tarefas: N · M vencidas`; atraso com ícone e texto | `BpmTarefa`, já parcialmente projetada por `ListarCardsPipelineBpm` |
| Cadência | Corpo | `Próximo: dd/mm · hh:mm` ou estado vazio explícito | `BpmCardCadencia.proximaExecucaoEm` |
| Próximo contato | Corpo | `Próximo contato` + data/hora; atraso com ícone e texto | `BpmCard.proximoContatoEm`, já retornado |
| Reunião — data/hora | Corpo especial | `Data e hora` + valor ou `Não definida` | `BpmCard.dataReuniao`, já retornado |
| Google Meet | Corpo especial | Botão `Agendar pelo Google Meet` ou link `Abrir Google Meet` | `BpmCard.googleMeetLink` + fluxo existente |
| Responsável | Rodapé | Avatares existentes, com nome em tooltip/texto acessível | `responsavel`/`membros`, já retornados |
| SLA | Rodapé | `SlaStatusBadge`, sempre com ícone/texto além da cor | Resumo de `sla.ts`, já retornado |

Não entram no catálogo v1 Anexos, Última interação, quantidade genérica de atividades, Valor, Status ou Data de conclusão: embora apareçam como exemplos amplos na ideia, a Fase 0 não confirmou para todos eles uma projeção canônica pronta e permission-aware. Eles ficam fora desta entrega até nova auditoria; não serão simulados nem derivados no client.

### Layout do card fechado

```text
┌─ faixa accent de 3 px ──────────────────────┐
│ [A] ACME Importadora                         │  cabeçalho
│     Nome fantasia ou identificação secundária│
│──────────────────────────────────────────────│
│ ◷ Próximo contato       08/09 · 14:00        │
│ ✓ Checklist                         3/5       │  corpo: 0–5 itens
│ ⚠ Tarefas                  4 · 1 vencida     │
│──────────────────────────────────────────────│
│ [avatares do responsável]          [SLA 2h]  │  rodapé opcional
└──────────────────────────────────────────────┘
```

- O cabeçalho usa `flex items-start gap-2.5`; avatar/inicial `h-8 w-8 rounded-xl`; título `text-sm font-semibold leading-tight text-white line-clamp-2`; secundário `text-[11px] text-slate-400 line-clamp-1`.
- O corpo usa uma única coluna, `space-y-2`, divisória superior `border-white/[0.06]` e itens de `text-[10px]` a `text-xs`. Ícone Lucide já instalado, rótulo e valor formam uma linha; o valor usa `tabular-nums` quando for data, contagem ou SLA.
- O rodapé usa `flex items-center justify-between`, `min-h-6`, `border-t border-white/[0.06] pt-2.5`. Se Responsável e SLA estiverem desabilitados/indisponíveis, o rodapé não reserva espaço vazio.
- Badges ficam restritos a estados semânticos que precisam de destaque. Dados comuns são linhas simples; não se cria uma borda por item.
- Cor nunca comunica estado sozinha: atraso/atenção sempre acompanha ícone e texto. Ciano informa dado operacional, âmbar informa atenção e rose informa atraso, reutilizando as famílias já presentes no `KanbanCard`.

### Shell, paleta, tipografia e espaçamento reaproveitados

- `GradientBlobCard` (`src/components/ui/gradient-blob-card.tsx`) continua sendo o shell único: `rounded-2xl`, `border-blue-600`, `bg-slate-800/95`, faixa esquerda de `3px` em `rgb(${accent})`, conteúdo `p-3`, sem novo wrapper visual.
- O `accent` continua vindo de `getTema(...).accent` em `CRMLayoutClient.tsx`; nenhuma paleta ou CSS variable paralela será criada.
- O card permanece sobre `crm-scope` + `CrmSpaceBackground`, com overlay de legibilidade de `CRMBackground.tsx` e base do layout `linear-gradient(180deg,#050b16,#020617)`.
- Tipografia continua na escala Tailwind já usada: `text-[9px]`/`text-[10px]` para indicadores, `text-[11px]`/`text-xs` para metadados e `text-sm` para a empresa; pesos `font-medium`, `font-semibold` e `font-bold` preservam a hierarquia.
- Espaçamento reutiliza a escala atual: `gap-1.5`, `gap-2`, `gap-2.5`, `space-y-2`, `pt-2.5` e `p-3`.
- Hover/focus segue a linguagem de `GradientBlobCard` e `FlowButton`: transição curta, `hover:scale-[1.02]` em 150 ms no card, foco visível com ring, e easing `cubic-bezier(0.22,1,0.36,1)` somente onde o controle existente já o usa. `motion-reduce` remove escala/animação.
- Não será adicionada biblioteca de UI, pacote de ícones ou design system. Controles administrativos usam os componentes shadcn/Radix já presentes e ícones de `lucide-react` já instalado.

### Estados visuais obrigatórios

| Estado | Especificação |
|---|---|
| Normal | Shell `GradientBlobCard`, opacidade 100%, hierarquia cabeçalho → corpo → rodapé e somente elementos autorizados/configurados. |
| Hover/foco | Escala 1.02 do shell, leve realce já existente e `focus-visible:ring-2`; não altera altura nem revela informação nova. |
| Sendo arrastado | Mantém o conteúdo, usa `opacity-40`, `cursor-grabbing`, `shadow-2xl shadow-black/40` e ring branco discreto já existentes; hover scale fica neutralizado durante o drag para evitar salto visual. |
| Virtual/placeholder NoLoss | Configuração da etapa não é aplicada. Mantém borda tracejada sky, Nome/Empresa, rótulo `Lead do site` e data de recebimento. Não exibe dados canônicos que ainda não existem; o fluxo atual de promoção ao mover permanece intacto. |
| Loading | Skeleton dentro do mesmo shell e largura do card, com três blocos (cabeçalho, duas linhas do corpo, rodapé), `animate-pulse` e equivalente estático em `motion-reduce`. Não renderiza valores fictícios. |
| Erro | O board/coluna mantém o erro observável e a ação de retry já existente; não cria um “card de erro” arrastável. Se apenas um item configurado falhar, omite esse item e mantém o card acessível, sem inferir valor. |
| Vazio | Coluna sem cards continua usando seu estado vazio atual; não instancia card placeholder de domínio. Item sem valor usa texto explícito somente quando o contrato existente já o prevê (`Sem data`, `Não definida`); caso contrário, o item é omitido. |
| SLA/contato/tarefa atrasados | Rose com ícone + texto/contagem; nunca apenas cor. O cálculo permanece no dado/helper canônico, não no renderer configurável. |
| Atenção | Âmbar ou vermelho conforme o estado canônico já projetado, com ícone e rótulo curto. Animação pulsante apenas quando já prevista e removida por `prefers-reduced-motion`. |

### Exceção preservada — Agendar Reunião

O ramo validado em RM-2026-6BEA04 tem precedência sobre a configuração genérica. Na etapa canônica **Agendar Reunião**, o corpo fechado mostra exclusivamente:

1. `MEETING_DATETIME`: rótulo **Data e hora** + valor ou **Não definida**;
2. `GOOGLE_MEET_ACTION`: **Agendar pelo Google Meet** quando não houver link, ou **Abrir Google Meet** quando `googleMeetLink` existir.

Não aparecem cabeçalho genérico, campos, pendências, checklist, tarefas, cadência, responsável ou SLA nesse ramo. O nome da empresa permanece no `aria-label` da superfície/botão para contexto acessível. Clique e `pointerdown` da ação Meet continuam interrompendo propagação para não abrir/arrastar o card indevidamente. A tela administrativa apresenta esses dois itens como preset protegido da etapa; eles podem ser reordenados entre si, mas não removidos nem misturados com o catálogo genérico. Isso preserva exatamente a restrição funcional já registrada, sem criar um segundo componente.

### Responsividade e densidade

- O card ocupa `w-full` da coluna existente, que hoje usa `w-full md:w-[220px] lg:w-[240px] xl:w-[260px]`; nenhum filho define largura mínima capaz de causar overflow horizontal.
- Rótulo e valor usam `min-w-0`; textos livres recebem `truncate`/`line-clamp-1`, e somente Nome/Empresa pode usar `line-clamp-2`.
- O limite de cinco itens de corpo, mais cabeçalho e rodapé compactos, mantém a altura em até `max-h-72`. O renderer não usa scroll interno e não corta item configurado: o editor impede a sexta seleção antes de salvar.
- Em viewport móvel, a composição interna e a ordem não mudam; a coluna continua `w-full`. Alvos interativos (Meet e abertura do card) mantêm foco visível e área acionável compatível com o controle atual.
- Datas/contagens não quebram linha (`whitespace-nowrap tabular-nums`). Labels longos de campo são truncados e preservam o texto integral em `title`/descrição acessível.

### Preview e tela de configuração

Em `Pipeline → Etapa → Card do Kanban`, a área de configuração usa duas regiões: lista ordenável à esquerda/acima e preview à direita/abaixo. Em telas estreitas elas empilham; a lista vem antes do preview. Cada linha possui controle visível, nome, origem (`Componente nativo` ou `Campo do pipeline`) e alça de ordenação operável também por teclado, seguindo o padrão `@dnd-kit` já instalado.

O fixture de preview usa uma empresa fictícia, datas relativas controladas, checklist `3/5`, tarefas `4 · 1 vencida`, três pendências e um responsável fictício. Nenhum texto do fixture é salvo. Toda alteração local de visibilidade/ordem é passada imediatamente ao mesmo renderer puro usado pelo board, em `mode="preview"`; o modo apenas desabilita navegação, drag do card e ações reais.

Ao atingir cinco itens de corpo, os demais controles ficam desabilitados e aparece: **“O card compacto aceita até 5 informações no corpo. Remova uma para adicionar outra.”** A mensagem não depende só de cor. A configuração só é persistida por ação explícita **Salvar**, com estado de salvamento e erro visíveis.

### Fallback e migração visual

- **Sem configuração persistida:** `COMPANY_NAME` no cabeçalho; `NEXT_CONTACT` e `PENDING_TASKS` no corpo; `RESPONSIBLE` e `SLA_STATUS` no rodapé. Valores indisponíveis são omitidos conforme as regras de vazio acima.
- **Agendar Reunião sem configuração:** usa sempre o preset protegido de data/hora + Meet.
- **Card virtual NoLoss:** usa sempre sua representação virtual atual, independentemente da configuração da etapa.
- A Fase 3 deve converter os ramos visuais atuais em definições iniciais equivalentes quando houver configuração persistida, sem alterar drag-and-drop, abertura de modal, realtime, transições ou policies de domínio.

### Verificação de disponibilidade dos dados e limite de escopo

Todos os elementos do catálogo v1 cruzam com a classificação da Fase 0: Nome/Empresa, Responsável, tarefas, próximo contato, SLA e reunião já estão no read model; Pendências, Checklist e Cadência possuem fonte canônica no schema e exigem somente ajuste de projeção; campos do pipeline já possuem `BpmCampo.id`/`chave` e exigem troca da busca por label para identidade estável.

Nenhum campo visual desta especificação exige nova coluna de domínio. A única estrutura inexistente é a própria configuração de apresentação (`BpmEtapaCardViewConfig` ou equivalente), já identificada pela Fase 0 e explicitamente fora desta fase documental. Sua criação continua condicionada a relatório Vault, backup verificável e aprovação específica em fase própria. Até isso ocorrer, esta fase não edita `src/`, `prisma/` nem migration.

### Caminho de entrega previsto e consumível

Após a fase executora e o gate de banco: administrador autenticado → `Alpha CRM` → `Configurações` → pipeline → etapa → `Card do Kanban` → seleciona e ordena até cinco itens → confere o preview compartilhado → salva → volta a `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → o mesmo `KanbanCard` renderiza a definição efetiva daquela etapa.

## Checklist de execução

- [x] **Fase 2 — Especificação visual**
  - [x] Definir se "default + override por pipeline" ou "configuração completa por etapa"
  - [x] Definir limite máximo de elementos por card
  - [x] Definir se o preview usa dados mockados ou dados reais
  - [x] Especificar o contrato exato de `CompactCardViewDefinition`
  - [x] Especificar o catálogo final de componentes nativos
  - [x] Especificar a hierarquia visual (cabeçalho/corpo/rodapé)

- [ ] **Fase 3 — Implementação**
  - [ ] Criar model `BpmEtapaCardViewConfig` (exige fase Vault)
  - [ ] Criar migration aditiva (validada por Vault, backup verificado)
  - [ ] Implementar UI de configuração em `AdminPipelineClient.tsx`
  - [x] Implementar renderer parametrizado em `PipelineBoardClient.tsx` (parcial: novos itens de corpo — checklist, cadência, pendências — adicionados ao fallback; renderer configurável completo depende do model de configuração)
  - [ ] Parametrizar read model em `ListarCardsPipelineBpm` (pendente: campos `checklistProgress`, `cadenciaProximaExecucaoEm`, `pendenciasObrigatorias` adicionados à interface; projeção na action pendente de fase com Vault)
  - [ ] Implementar preview reutilizando o mesmo renderer
  - [x] Implementar fallback seguro (itens novos omitidos quando ausentes, conforme especificação)
  - [ ] Implementar respeito a permissões
  - [ ] Adicionar 18 testes da ideia
  - [ ] Rodar gates: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`

## File List

- `docs/stories/story-rm-2026-8852c2-melhoria-kanban-card.md` — seção **Especificação Visual**, decisões da Fase 2, checklist e rastreabilidade documental.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — Fase 3 (parcial): interface `CardBpm` ampliada com `checklistProgress`, `cadenciaProximaExecucaoEm`, `pendenciasObrigatorias`; novos itens de corpo (Pendências, Checklist, Cadência) renderizados condicionalmente no `KanbanCard`, seguindo a especificação visual (ícone + label + valor, `tabular-nums`, cores semânticas). Fallback preservado: elementos omitidos quando dados ausentes.

### Pendências da Fase 3 (fora do escopo desta execução)

| Item | Motivo |
|------|--------|
| Read model (`ListarCardsPipelineBpm`) projetar `checklistProgress`, `cadenciaProximaExecucaoEm`, `pendenciasObrigatorias` | Requer queries adicionais em `BpmCardChecklist`, `BpmCardCadencia` e RequirementPolicy; pode ser feito sem schema novo, mas exige fase própria para evitar N+1 e validar performance |
| Renderer configurável (interpretar `CompactCardViewDefinition`) | Depende do model `BpmEtapaCardViewConfig` — exige fase Vault |
| UI de configuração em `AdminPipelineClient.tsx` | Depende do model de configuração |
| Preview | Depende do renderer configurável |
| 18 testes da ideia | Depende do renderer configurável + read model |

## Notas

- **Artigo IV (Sem Invenção):** Esta story não inventa requisitos fora da ideia anexada. Decisões de produto pendentes (default+override vs. configuração completa, limite de elementos, dados do preview) estão registradas como pendências explícitas, não resolvidas arbitrariamente.
- **Artigo V (Segurança):** A configuração visual é presentation layer. Não altera autenticação, autorização, ownership ou persistência.
- **Artigo VI (Memória):** Esta story deve ser registrada em `.bibble/memory/architecture.md` após a implementação.
- **Artigo VII (Imports absolutos):** Aplicável na implementação (Fase 3), não na redação desta story.
- **Gate de banco:** A criação do model `BpmEtapaCardViewConfig` exige fase própria de Vault (backup, migration, validação). Esta story registra a necessidade, mas a implementação do model fica para uma fase executora com aprovação de banco.
