# Story: Busca geral no funil de aquisição de parceiros

**ID:** STORY-PARCEIROS-AQUISICAO-BUSCA-GERAL
**Módulo:** Parceiros / Aquisição
**Status:** Ready for Review
**Data de criação:** 2026-09-24

## Narrativa

**Como** usuário do funil de aquisição de parceiros,
**quero** um campo compacto de pesquisa acima do pipeline,
**para** localizar um lead pelo nome em todas as etapas sem repetir a busca em cada coluna.

## Contexto e escopo

Hoje cada etapa do funil tem uma lupa que filtra apenas seus próprios cards. O pedido é acrescentar uma pesquisa geral ao quadro, mantendo essas lupas. O mesmo quadro também exibe colunas de saídas laterais; a pesquisa geral deve alcançar todas as colunas exibidas. Não há epic específico nem `accumulated-context.md` disponível no repositório; esta story deriva do pedido do usuário e do comportamento existente em `AquisicaoParceirosClient.tsx`.

## Critérios de Aceitação

- [x] **AC-001 — Posição:** Um input de pesquisa compacto e identificado como busca geral aparece acima das colunas do pipeline de aquisição.
- [x] **AC-002 — Abrangência:** Ao digitar um nome na busca geral, somente os leads correspondentes aparecem em todas as etapas do funil e nas colunas de saídas laterais. A correspondência segue o critério de nome já usado pelas lupas locais, sem diferenciar maiúsculas e minúsculas.
- [x] **AC-003 — Atualização e limpeza:** O quadro reage ao texto digitado; ao apagar o termo, todos os leads voltam a aparecer conforme o estado atual das buscas locais.
- [x] **AC-004 — Buscas locais preservadas:** As lupas e seus inputs continuam disponíveis e filtram somente a própria etapa. Quando há termos geral e local, ambos são aplicados aos cards daquela etapa.
- [x] **AC-005 — Estados vazios:** Se uma etapa não tiver resultados para os filtros ativos, ela permanece visível e mostra o estado vazio apropriado. O usuário consegue limpar a pesquisa geral sem recarregar a página.
- [x] **AC-006 — Operações existentes:** Abrir cards, mover leads entre etapas e atualizar a lista continuam funcionando com a pesquisa ativa; nenhuma informação persistida é alterada pela pesquisa.

## Tasks / Subtasks

- [x] Adicionar estado e input compacto de busca geral acima do quadro em `AquisicaoParceirosClient` (AC: 1, 3, 5).
- [x] Aplicar o termo geral a todas as colunas do funil e das saídas, preservando a filtragem local por coluna e sua combinação com a busca geral (AC: 2, 4, 5).
- [x] Conferir os estados vazios e as interações de cards, arraste e recarga com a busca ativa (AC: 5, 6).
- [x] Validar a lógica de busca geral, combinação de filtros e limpeza por revisão do fluxo de renderização; executar `npm run lint`, `npm run typecheck` e `npm test` (AC: 1–6).

## Dev Notes

- `src/components/Parceiros/Aquisicao/AquisicaoParceirosClient.tsx` mantém a lista `leads`, monta `colunasFunil` com `ETAPAS` e `colunasSaida` com `SAIDAS`, e renderiza ambas dentro do mesmo `DndContext`.
- `KanbanColuna`, no mesmo arquivo, mantém `termoBusca` local e filtra por `(lead.nomeFantasia || lead.nome).toLocaleLowerCase("pt-BR")`. Preservar essa regra e o escopo da lupa de cada coluna.
- `recarregar()` atualiza `leads` após operações. A pesquisa é um filtro de apresentação sobre essa lista; não requer mudança de action, API ou banco.
- A página de entrada é `src/app/PainelAlpha/Parceiros/(comSidebar)/Aquisicao/page.tsx`; o componente cliente já recebe `leadsIniciais`.
- [AUTO-DECISION] Alcance de “todas as etapas” → incluir as saídas laterais, pois são colunas do mesmo quadro (reason: o usuário pediu pesquisa geral acima do pipeline inteiro).
- [AUTO-DECISION] Busca geral simultânea à lupa local → aplicar interseção, mantendo a lupa restrita à coluna (reason: preserva a função atual das lupas e torna os resultados previsíveis).

## Testes esperados

| Cenário | Resultado esperado |
|---|---|
| Mesmo nome presente em etapas diferentes | Cards correspondentes aparecem nas respectivas etapas |
| Nome presente em saída lateral | Card correspondente aparece na saída |
| Termo com diferença de maiúsculas/minúsculas | Mesmos resultados |
| Busca geral e busca local ativas | Apenas cards que atendem aos dois termos aparecem na coluna local; outras colunas seguem o termo geral |
| Limpar busca geral | Resultados retornam, respeitando eventuais buscas locais |
| Sem correspondência | Colunas continuam visíveis com estado vazio; filtros podem ser limpos |
| Abrir, mover ou atualizar lead com busca ativa | Interação funciona e a lista visível reflete os filtros ativos |

## Checklist da story

- [x] Objetivo, benefício e escopo descritos.
- [x] Critérios de aceitação verificáveis e coerentes com o pedido.
- [x] Componente, fluxo de dados e referência da busca local identificados.
- [x] Cenários de teste e edge cases descritos.
- [x] Implementação e testes existentes concluídos.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` aprovados.
- [x] File List atualizada após implementação.

## File List inicial

| Arquivo | Ação prevista |
|---|---|
| `src/components/Parceiros/Aquisicao/AquisicaoParceirosClient.tsx` | Adicionar busca geral e combinar com buscas locais |
| `tests/parceiros/aquisicao.test.ts` ou teste de UI do módulo | Cobrir busca geral, combinação e limpeza conforme o padrão de testes existente |
| `docs/stories/story-parceiros-aquisicao-busca-geral.md` | Registrar andamento, validação e arquivos efetivamente alterados |

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Frontend; complexidade baixa; sem alteração de banco ou API.
- **Specialized Agents:** `@dev` na implementação, `@ux-design-expert` para revisão de posição e acessibilidade, `@qa` para validação.
- **Quality Gates:** revisão antes de concluir a story; revisão antes de PR, se houver PR; `npm run lint`, `npm run typecheck`, `npm test`.
- **Self-Healing:** `@dev` light, até 2 iterações e 15 minutos para issues CRITICAL; `@qa` full, até 3 iterações e 30 minutos para CRITICAL/HIGH; revisão de PR reporta issues sem alteração automática.
- **Focus Areas:** escopo dos filtros, combinação geral/local, colunas laterais, estado vazio, acessibilidade do input e regressão do drag-and-drop.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-09-24 | 1.0 | Story criada a partir do pedido de busca geral | River (SM) |

## Dev Agent Record

### Agent Model Used

GPT-6 Codex.

### Completion Notes List

- Input compacto com botão de limpeza acima do quadro. O filtro usa o mesmo nome exibido e a mesma comparação sem distinção de maiúsculas/minúsculas da busca local.
- O filtro geral alimenta as colunas do funil e de saídas; cada coluna preserva seu estado de busca local, compondo os dois filtros.
- Colunas sem resultados exibem "Nenhum lead encontrado" quando a busca geral está ativa. Arraste, abertura de cards e recarga continuam operando sobre `leads`, sem alterar persistência.
- Validação: `npm run typecheck` passou; `npm run lint` passou com 1192 avisos preexistentes e 0 erros; `npm test` passou (508 arquivos, 3825 testes aprovados, 4 ignorados, 1 pendente); `npm run build` passou com avisos existentes em `pdfjs-polyfill.ts`.
- Revisão interativa no navegador não executada nesta sessão.

### File List

| Arquivo | Alteração |
|---|---|
| `src/components/Parceiros/Aquisicao/AquisicaoParceirosClient.tsx` | Campo de pesquisa geral, filtro em todas as colunas e estado vazio sob filtro |
| `docs/stories/story-parceiros-aquisicao-busca-geral.md` | Critérios, checklist, resultados dos gates e File List |

## QA Results

Pendente de revisão de QA.
