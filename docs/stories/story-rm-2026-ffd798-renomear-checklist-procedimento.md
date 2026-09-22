# RM-2026-FFD798 — Mudança de nomenclatura: Checklist → Procedimento no Alpha CRM

## Status

Ready for Testing

## Cabeçalho

- **Código da RM:** RM-2026-FFD798
- **Título:** Mudança de nomenclatura: Checklist → Procedimento no Alpha CRM
- **Data:** 2026-09-09 (revisada em 2026-09-21 após reinspeção do código real)
- **Projeto:** Painel Alpha

## Contexto

O administrador solicitou a troca da nomenclatura da funcionalidade de **Checklist** para **Procedimento** no módulo **Alpha CRM** do Painel Alpha. A mudança é puramente de rótulo de apresentação (superfície visível ao usuário): títulos, subtítulos, botões, toasts, `aria-label`s, placeholders e textos de estado/timeline. Nenhum nome de tabela, coluna, model Prisma, Server Action, capability ou rendererId será alterado — portanto **nenhuma migration de banco é necessária**.

### Nota de revisão (feedback do administrador: "Tente de novo")

Uma versão anterior desta story listava 5 arquivos (`ChecklistsWorkspace.tsx` h1/subtítulo, `EtapasMultiSelect.tsx`, `PainelChecklistsCard.tsx`, `CardOpenFormSlot.tsx`, `PainelChecklistFollowUp.tsx`) como pendentes de renomeação. Reinspeção direta do código confirmou que **esses textos já foram renomeados em sessão anterior** (ex.: `ChecklistsWorkspace.tsx:133` já diz "Templates de procedimento"; `PainelChecklistsCard.tsx:123-126` já diz "Nenhum procedimento se aplica a este card." / "Este procedimento não tem itens."; `CardOpenFormSlot.tsx:62` já diz "Abrir procedimentos da etapa"). Essa versão da story corrige o escopo com base na leitura real e atual do código, listando exclusivamente as ocorrências que **ainda** exibem "Checklist"/"checklist" ao usuário.

## Escopo confirmado (reinspeção de 2026-09-21)

### Arquivos frontend com textos visíveis a alterar

| # | Arquivo:linha | Texto atual → novo |
|---|---------|----------------------|
| 1 | `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx:150` | `TabsTrigger` do card: "Checklist" → "Procedimento" |
| 2 | `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx:183` | Toast de bloqueio: "Conclua o checklist do último follow-up antes de fechar este card." → "Conclua o procedimento do último follow-up antes de fechar este card." |
| 3 | `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx:119` | `aria-label`: "Abrir checklist para concluir" → "Abrir procedimento para concluir" |
| 4 | `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx:160` | `placeholder`: "Título do checklist" → "Título do procedimento" |
| 5 | `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx:558` | `TabsTrigger` admin: "Checklists" → "Procedimentos" |
| 6 | `src/components/bpm/checklists/ChecklistsWorkspace.tsx:137` | `DialogDescription`: "Alterações no template não modificam checklists já materializados." → "Alterações no template não modificam procedimentos já materializados." |
| 7 | `src/components/bpm/pendencias/PendenciasWorkspace.tsx:20` | Label do tipo de pendência: "Checklist pendente" → "Procedimento pendente" |
| 8 | `src/components/bpm/pendencias/PendenciasWorkspace.tsx:30` | Label do filtro: "Checklists" → "Procedimentos" |
| 9 | `src/app/PainelAlpha/AlphaCRM/tarefas/TarefasCentralClient.tsx:97-98` | `aria-label`: `` `Abrir checklist ${...} no card` `` → `` `Abrir procedimento ${...} no card` `` |
| 10 | `src/app/PainelAlpha/AlphaCRM/tarefas/TarefasCentralClient.tsx:108` | Badge visível: "Checklist" → "Procedimento" |
| 11 | `src/lib/bpm/historico-descricao.ts:305` | "Item de checklist atualizado" → "Item de procedimento atualizado" |
| 12 | `src/lib/bpm/historico-descricao.ts:307` | "Item de checklist adicionado" → "Item de procedimento adicionado" |
| 13 | `src/lib/bpm/historico-descricao.ts:308` | `` `Checklist ${nome} aplicado ao card` `` → `` `Procedimento ${nome} aplicado ao card` `` |
| 14 | `src/lib/bpm/historico-descricao.ts:311` | "Item de checklist marcado como" / "Status do checklist atualizado" → "Item de procedimento marcado como" / "Status do procedimento atualizado" |
| 15 | `src/lib/bpm/historico-descricao.ts:313` | "Tarefa criada automaticamente a partir do checklist" → "Tarefa criada automaticamente a partir do procedimento" |
| 16 | `src/lib/bpm/historico-descricao.ts:314` | "Tarefa do checklist sincronizada" → "Tarefa do procedimento sincronizada" |
| 17 | `src/lib/bpm/historico-descricao.ts:315` | "Tarefa reaberta porque o checklist voltou a ter pendências" → "Tarefa reaberta porque o procedimento voltou a ter pendências" |
| 18 | `src/lib/bpm/historico-descricao.ts:316` | "Tarefa concluída automaticamente com o checklist" → "Tarefa concluída automaticamente com o procedimento" |

`historico-descricao.ts:165/173` usa `checklist` como nome de variável interna (mapa de rótulos de status) — **preservar**, não é texto visível diretamente.

### Já renomeado em sessão anterior (confirmado, não requer nova alteração)

- `src/components/bpm/checklists/ChecklistsWorkspace.tsx:133,135` — "Templates de procedimento" / "cada procedimento deve aparecer" / "Buscar templates" / "Novo template".
- `src/components/bpm/checklists/EtapasMultiSelect.tsx:68-69` — "Escolha se o procedimento se aplica..." / "Selecione um pipeline para restringir o procedimento...".
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx:123,126` — "Nenhum procedimento se aplica a este card." / "Este procedimento não tem itens." (o `h3`/`aria-label`/`sr-only` desse arquivo devem ser reconferidos na implementação, pois não puderam ser lidos por completo nesta fase de story — ver Riscos).
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx:62` — "Abrir procedimentos da etapa".
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx` — mensagens de follow-up já usam "Procedimento" onde visível (reconferir na implementação).

### Arquivos backend/Server Actions com texto visível ao usuário

Nenhum. As Server Actions em `src/actions/bpm/Checklists.ts` retornam objetos estruturados (`{success, error?}`) com mensagens genéricas ("Erro ao criar template", "Erro ao atualizar template" etc.) sem a palavra "checklist" exposta à UI.

### O que **não** será alterado (e por quê)

| Item | Motivo |
|------|--------|
| Models Prisma: `BpmChecklistTemplate`, `BpmChecklistTemplateEtapa`, `BpmChecklistTemplateItem`, `BpmCardChecklist`, `BpmCardChecklistItem`, `BpmChecklistFollowUp`, `BpmChecklistFollowUpPergunta` | Renomear exigiria migration destrutiva (recriação de tabela no Turso) — desnecessário para mudança de rótulo |
| Server Actions e tipos: `ListarChecklistsCardBpm`, `AtualizarItemChecklistCardBpm`, `AdicionarItemExclusivoChecklistCardBpm`, `CriarTemplateChecklistBpm`, `SalvarTemplateChecklistBpm`, `AlternarTemplateChecklistBpm`, `SalvarChecklistFollowUpBpm`, campo `cardChecklistId`, eventos `CHECKLIST_*`/`TAREFA_CHECKLIST_*` do histórico | Nomes internos de função/tipo/evento; não visíveis ao usuário; renomear quebraria referências em múltiplos arquivos sem necessidade |
| Arquivos: `src/lib/bpm/checklists/*`, `src/components/bpm/checklists/*`, `src/actions/bpm/Checklists.ts`, `checklist-editor-state.ts` | Nomes de arquivo internos; renomear não agrega valor e quebra imports |
| Capability `configurarChecklists` | Estrutura de permissão; renomear exigiria migração de dados de permissão |
| RendererIds `stage-checklist` / `follow-up-checklist` | Contratos de composição; renomear quebra referências em múltiplos arquivos |
| Rota `/PainelAlpha/AlphaCRM/admin/checklists` | Slug de rota; renomear quebraria links/bookmarks existentes sem necessidade funcional |
| Módulo operacional `Alpha CheckList` (`/PainelAlpha/CheckList`, models `Checklist`/`ItemChecklist`/`PastaChecklist`, permissão `checkList`) | Módulo **distinto** do Alpha CRM (categoria `operacional`); fora do escopo desta RM |
| Nomes de templates criados por administradores | Dados persistidos pelo usuário; a nomenclatura da funcionalidade muda, não os dados cadastrados |

## Critérios de aceite

1. Todo texto visível ao usuário no módulo Alpha CRM que hoje diz "Checklist"/"checklist" (as 18 ocorrências da tabela acima) passa a dizer "Procedimento"/"procedimento", respeitando maiúsculas/minúsculas e concordância gramatical em português.
2. Os textos já renomeados em sessão anterior (seção "Já renomeado") são reconferidos e, se ainda houver alguma ocorrência residual de "checklist" visível nesses mesmos arquivos, ela também é corrigida.
3. Nenhuma regressão funcional: os componentes continuam funcionando exatamente como antes (dados, ações, navegação, eventos), apenas o texto muda.
4. Nenhuma migration de banco é executada; nenhum nome de model, Server Action, capability, rendererId ou rota é alterado.
5. Build, lint e typecheck aprovados nos arquivos alterados (zero novos erros/warnings atribuíveis a esta mudança).
6. Testes em `tests/bpm/` que fazem assertion sobre os textos trocados são atualizados para refletir "Procedimento"; testes que dependem de seletores/valores internos (não texto visível) permanecem inalterados.
7. O módulo operacional `Alpha CheckList` (`/PainelAlpha/CheckList`) permanece inalterado.

## Plano técnico

### Componente por componente

1. `PainelHistorico.tsx:150` — trocar label do `TabsTrigger`.
2. `CardFullViewModal.tsx:183` — trocar texto do toast de bloqueio.
3. `PainelTarefasPorTipo.tsx:119,160` — trocar `aria-label` e `placeholder`.
4. `AdminPipelineClient.tsx:558` — trocar label do `TabsTrigger` admin.
5. `ChecklistsWorkspace.tsx:137` — trocar texto do `DialogDescription`.
6. `PendenciasWorkspace.tsx:20,30` — trocar labels de tipo/filtro de pendência.
7. `TarefasCentralClient.tsx:97-98,108` — trocar `aria-label` (template literal) e texto do badge.
8. `historico-descricao.ts:305,307,308,311,313-316` — trocar as 8 strings de descrição de eventos de histórico ligados a checklist.
9. Reconferir os 5 arquivos já renomeados (seção acima) buscando por `grep -ri "checklist"` restrito a texto entre aspas/JSX, para capturar qualquer ocorrência residual.

### Regra de substituição

- "Checklist" (início de frase/título) → "Procedimento"
- "checklist" (meio de frase) → "procedimento"
- "Checklists" (plural, título) → "Procedimentos"
- "checklists" (plural, meio de frase) → "procedimentos"
- **Não** alterar: "checklist" em nomes de variáveis, imports, IDs de DOM/CSS (`checklist-pendencias`, `checklist-nome`, `checklist-descricao`, `escopo-etapa-checklist`), nomes de eventos (`bpm:abrir-pendencias-checklist`, `bpm:checklist-resumo`), rendererIds, capability names, nomes de arquivos, nomes de models/campos Prisma (`cardChecklistId`, `templateNome` etc.).

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Texto "Checklist" embutido em dado persistido (ex.: nome de template salvo pelo usuário) | Apenas o rótulo da funcionalidade muda; nomes de templates criados por administradores permanecem como o admin os nomeou |
| Omissão de alguma ocorrência de "checklist" em string visível, incluindo nos 5 arquivos já renomeados | A fase executora deve revalidar com busca textual completa (`grep -rni "checklist" src/`) e inspecionar manualmente cada ocorrência antes de decidir se é texto visível ou identificador interno |
| Testes em `tests/bpm/` com assertion sobre o texto antigo ("Checklist") quebrarem após a troca | Atualizar as assertions de texto visível junto da implementação; rodar `npx vitest run tests/bpm/` antes de concluir |
| Regressão em `aria-label`/`sr-only` afetando acessibilidade | Trocar o texto de forma equivalente, mantendo estrutura semântica idêntica |
| Módulo `Alpha CheckList` (`/PainelAlpha/CheckList`) acidentalmente alterado | Escopo restrito aos 9 arquivos da tabela; esse módulo está em `src/app/PainelAlpha/CheckList/` — fora do escopo |

## Auditoria de entregabilidade

- **Artefato final:** Troca de rótulos em 9 arquivos frontend/lib do módulo Alpha CRM (18 ocorrências de texto visível).
- **Quem consome:** Usuários do Alpha CRM (admin e operadores) nas telas de card (aba Procedimento, tarefas, histórico), workspace de templates, configuração de pipeline (admin) e central de tarefas/pendências.
- **Caminho de acesso:**
  - `Alpha CRM → card do pipeline → aba "Procedimento"` (`PainelHistorico.tsx`) e toast de fechamento (`CardFullViewModal.tsx`)
  - `Alpha CRM → card → Tarefas` (`PainelTarefasPorTipo.tsx`) — criar tarefa tipo procedimento e concluir
  - `Alpha CRM → Configurações → pipeline → aba "Procedimentos"` (`AdminPipelineClient.tsx`)
  - `Alpha CRM → Configurações → /PainelAlpha/AlphaCRM/admin/checklists` (`ChecklistsWorkspace.tsx`) — dialog de edição de template
  - `Alpha CRM → Pendências` (`PendenciasWorkspace.tsx`) — filtro e badge de pendência
  - `Alpha CRM → Tarefas` (`TarefasCentralClient.tsx`) — lista central de tarefas
  - `Alpha CRM → card → Histórico` (`historico-descricao.ts`) — descrição amigável de eventos de procedimento
- **Lacuna de capacidade:** Nenhuma. Todos os caminhos acima já existem, são acessíveis via rotas protegidas e renderizam componentes reais; a fase executora apenas troca o texto listado.

DELIVERY_READY: os 9 arquivos e 18 ocorrências listados acima têm caminho de consumo real e já validado por código; a implementação é troca pontual de string/label, sem necessidade de nova rota, componente ou migration.

## Arquivos afetados

- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/components/bpm/checklists/ChecklistsWorkspace.tsx`
- `src/components/bpm/pendencias/PendenciasWorkspace.tsx`
- `src/app/PainelAlpha/AlphaCRM/tarefas/TarefasCentralClient.tsx`
- `src/lib/bpm/historico-descricao.ts`
- Reconferência (sem alteração esperada, apenas validação): `src/components/bpm/checklists/EtapasMultiSelect.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx`

## Migration

**Nenhuma migration necessária.** A troca é puramente de rótulo de apresentação; nenhum nome de tabela/coluna/model é alterado.

## Encerramento da execução — 2026-09-22

A implementação foi concluída e ampliou o inventário inicial após nova varredura de superfície. Além dos nove arquivos originalmente listados, foram corrigidos rótulos visíveis em timeline, catálogo de automações, formulários de etapa, tipos/títulos de tarefas, reconciliação de tarefa derivada e mensagens públicas de follow-up/transição. Contratos internos (`CHECKLIST`, models Prisma, rotas, capabilities, rendererIds, nomes de arquivos e funções) foram preservados.

### Checklist de aceite

- [x] Aba, administração, tarefas, pendências e histórico exibem Procedimento(s).
- [x] Mensagens públicas do backend usam procedimento, sem alterar códigos internos.
- [x] Catálogo de automações, formulário de etapa, timeline e card Kanban usam a nova nomenclatura.
- [x] Nenhuma migration, alteração de schema ou mutação de banco executada.
- [x] `npm run typecheck` aprovado.
- [x] Lint direcionado aprovado sem erros novos; avisos preexistentes do `CardFullViewModal` não pertencem a esta troca textual.
- [x] Suíte BPM aprovada: 126 arquivos e 927 testes.
- [x] `npm run build` aprovado; somente avisos preexistentes do `pdfjs`.

### Arquivos adicionais alterados

- `src/actions/bpm/Checklists.ts`
- `src/actions/bpm/FollowUp.ts`
- `src/lib/bpm/timeline.ts`
- `src/lib/bpm/transicao-command.ts`
- `src/lib/bpm/automacoes/catalogo-modulos.ts`
- `src/lib/bpm/card-kanban.ts`
- `src/lib/bpm/tarefas-tipo.ts`
- `src/lib/bpm/formularios-etapa.ts`
- `src/lib/bpm/checklists/reconciliacao-tarefa.ts`
- `src/lib/bpm/em-tratativa.ts`
- `tests/bpm/checklists-reconciliacao-tarefa.test.ts`
- `tests/bpm/tarefas-checklist-actions.test.ts`

DELIVERY_READY: Alpha CRM → pipeline → card → aba “Procedimento”; Configurações → pipeline → “Procedimentos”; tarefas, pendências, timeline e automações apresentam a mesma nomenclatura.
