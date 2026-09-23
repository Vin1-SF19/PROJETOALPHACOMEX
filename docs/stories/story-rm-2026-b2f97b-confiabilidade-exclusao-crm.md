# Story — RM-2026-B2F97B: Garantir resultado confiável e verificável na exclusão de card

**Status:** Blueprint consolidado — pronto para implementação (Fases 3–8)
**RM:** RM-2026-B2F97B
**Fase:** 2 de 3 (story)
**Data:** 2026-09-22
**Executor:** nova (Bibble Squad)

---

## Contexto

- **RM:** RM-2026-B2F97B — "Garantir resultado confiável e verificável"
- **Módulo:** Alpha CRM
- **Diagnóstico:** `diag_a6ab6b44-8a52-4fe6-9a0b-1281f155fba0`
- **Proposta:** `proposal_923114cb09f7503d`
- **Dependência:** RM-2026-1FFBAA (política de arquivamento/soft-delete e autorização efetiva — já implementada)

### Estado atual verificado (Fase 1 — blueprint)

| Aspecto | Status |
|---------|--------|
| Action canônica `ExcluirCardBpm` | Existe em `src/actions/bpm/Cards.ts` (~linhas 2400–2456); soft-delete (`status: "ARQUIVADO"`); guard `exigirAcessoBpmCard` anti-TOCTOU; realtime `CARD_EXCLUIDO`; `revalidatePath` |
| Permissão `excluirCard` | `src/lib/bpm/ownership.ts` — RESPONSAVEL e ADMINISTRADOR; PARTICIPANTE não tem |
| Realtime / Pusher | `src/lib/bpm/realtime.ts` — canal `private-alpha-crm-pipeline-{pipelineId}`, evento `alpha-crm-atualizado`, `CARD_EXCLUIDO` em `BPM_REALTIME_TIPOS` |
| UI de disparo | `CardAbertoLayout.tsx` — botão visível por `podeGerenciarMembros`; `AlertDialog`; toast de sucesso/erro; **sem remoção local imediata do board** |
| Board | `PipelineBoardClient.tsx` — importa `MoverCardBpm`, `CriarCardBpm`, `ListarCardsPipelineBpm`; **não importa `ExcluirCardBpm`**; Pusher é canal primário; `onAtualizado()` faz refetch |
| Testes existentes | `tests/bpm/excluir-card-action.test.ts` (behavioral, SQLite in-memory); `tests/bpm/excluir-card.test.ts` (source-level assertions) |
| Infraestrutura de testes | Vitest (`vitest.config.ts`); banco descartável via `@libsql/client` com `file:` em `mkdtempSync` |
| Validação Zod | `ExcluirCardBpm` usa Zod **inline** — não usa schema nomeado de `@/lib/validations/bpm` (inconsistência com padrão do projeto) |
| Erros retornados | `"Não autorizado"` ou `"Erro ao excluir card"` — **sem diferenciação** de tipo |

### Sinais de autoajuste herdados (Fase 0)

A Fase 0 (auditoria de entregabilidade) sinalizou `AUTO_ADJUSTMENT_REQUIRED` para os seguintes itens, todos ainda pendentes de implementação:

1. **Remoção local imediata do board** — o board não remove o card do estado local após exclusão confirmada; depende exclusivamente de Pusher ou refetch manual.
2. **Diferenciação de erros** — a action retorna strings genéricas; não há códigos de erro distintos (`NÃO_AUTORIZADO`, `DEPENDENCIA_EXISTENTE`, `FALHA_TECNICA`).
3. **Testes comportamentais** — a suíte existente cobre o fluxo básico, mas não cobre explicitamente: (a) atualização sem Pusher, (b) falha de transporte do Pusher, (c) exclusão concorrente.
4. **Separação erro vs. estado vazio** — o board precisa de verificação se `error` e `empty` estão separados no estado de cards.

**Aceite adicional necessário:** cada item acima deve ser implementado e testado antes de considerar a story pronta.

---

## Critérios de aceite

Mapeados 1:1 aos itens 4–10 do objetivo RM-2026-B2F97B.

### AC1 — Atualização do board após exclusão (item 4)

O estado do board é atualizado automaticamente após exclusão de card confirmada, **sem exigir refresh manual** e **sem depender exclusivamente de Pusher**.

- Após `ExcluirCardBpm` retornar sucesso, o card é removido do estado local do board imediatamente.
- Pusher continua como canal de sincronização entre abas/sessões, mas não é o único mecanismo.
- Fallback: se Pusher não estiver disponível, o board ainda reflete a exclusão.

**Aceite:** `PipelineBoardClient.tsx` remove o card do estado local ao receber callback de exclusão bem-sucedida; teste cobre o caso sem Pusher.

### AC2 — Erros diferenciados (item 5)

Erros de **autorização**, **dependência** e **falha técnica** retornam mensagens diferenciadas ao usuário.

| Código | Mensagem ao usuário | Detalhe técnico |
|--------|-------------------|-----------------|
| `NÃO_AUTORIZADO` | "Você não tem permissão para excluir este card." | `console.error` com userId, cardId, role |
| `DEPENDENCIA_EXISTENTE` | "Este card possui dependências ativas. Verifique antes de excluir." | `console.error` com lista de dependências |
| `FALHA_TECNICA` | "Ocorreu um erro ao excluir o card. Tente novamente." | `console.error` com stack trace completo |

**Aceite:** a action retorna `{ success: false, error: <código>, mensagem: <string> }`; a UI mapeia o código para a mensagem adequada; detalhes internos (stack, query, IDs internos) aparecem **somente** em `console.error` server-side, nunca na resposta ao cliente.

### AC3 — Testes comportamentais com banco descartável (item 6)

Suíte de testes comportamentais de exclusão roda contra **banco descartável com relações reais** (card, reunião, follow-up, setor) e é **reproduzível localmente/CI**.

- Banco: SQLite in-memory ou Turso local (padrão do projeto: `@libsql/client` com `file:` em `mkdtempSync`).
- Relações reais: `BpmCard`, `BpmReuniao` (ou equivalente), `BpmFollowUp` (ou equivalente), `BpmSetor`.
- Reproduzível: `npm test` ou `npx vitest run tests/bpm/excluir-card-action.test.ts` passa sem dependência de ambiente externo.

**Aceite:** `tests/bpm/excluir-card-action.test.ts` (ou arquivo equivalente) cobre o fluxo completo com banco descartável e relações reais.

### AC4 — Casos específicos de teste (item 7)

Testes cobrem explicitamente:

- **(a) Atualização de estado sem Pusher disponível** — mock de Pusher indisponível; board ainda remove o card do estado local.
- **(b) Falha de transporte do Pusher** — mock de erro de transporte; board não quebra, mostra estado consistente.
- **(c) Duas exclusões concorrentes do mesmo card** — segunda chamada retorna idempotente (card já arquivado), sem erro de constraint.

**Aceite:** três testes nomeados explicitamente cobrindo cada caso; todos passam em `npm test`.

### AC5 — Erro de carregamento vs. estado vazio (item 8)

Tela de carregamento inicial do board mostra **estado de erro visualmente distinto de estado vazio**, com mensagem específica.

- **Erro:** ícone de erro + mensagem "Não foi possível carregar o board. Tente novamente." + botão "Tentar novamente".
- **Vazio:** ícone de inbox + mensagem "Nenhum card neste pipeline." (sem botão de retry).
- **Loading:** skeleton (já existe em `PipelineBoardSkeleton.tsx`).

**Aceite:** `PipelineBoardClient.tsx` (ou componente equivalente) distingue os três estados; teste de renderização cobre cada estado.

### AC6 — Consistência campos diretos vs. entidades normalizadas (item 9)

Campos diretos do card relativos a **reunião** e **follow-up** permanecem consistentes com as entidades normalizadas correspondentes após qualquer mutação.

- Campos diretos: `dataReuniao`, `googleMeetLink`, `proximoContatoEm`.
- Entidades normalizadas: `PainelReuniao`, `PainelStandbyFollowUp`.
- Após arquivamento: campos diretos **não são limpos** (soft-delete preserva dados), mas a UI trata card arquivado como inativo nesses painéis.
- Verificação automatizada: teste asserciona que campos diretos e entidades normalizadas estão em sincronia após mutação.

**Aceite:** teste em `tests/bpm/excluir-card-action.test.ts` (ou arquivo equivalente) asserciona consistência entre campos diretos e entidades normalizadas após arquivamento.

### AC7 — Comando canônico único (item 10)

Existe um **único comando canônico** de exclusão; validadores legados divergentes são reconciliados ou removidos, sem duplicidade de regra de negócio.

- `ExcluirCardBpm` em `src/actions/bpm/Cards.ts` é o comando canônico.
- `excluirCardSchema` criado em `@/lib/validations/bpm` e usado na action (padrão do projeto).
- Nenhum outro validador de exclusão existe em `@/lib/validations/bpm` ou em qualquer outro arquivo.

**Aceite:** `excluirCardSchema` em `src/lib/validations/bpm.ts`; `ExcluirCardBpm` importa e usa esse schema; busca de código confirma ausência de validadores duplicados.

---

## Checklist de execução

A ser marcado pelas Fases 3–8.

### Fase 3 — Implementação backend

- [x] Criar `excluirCardSchema` em `src/lib/validations/bpm.ts`
- [x] Atualizar `ExcluirCardBpm` para usar `excluirCardSchema` (AC7)
- [x] Atualizar `ExcluirCardBpm` para retornar `{ success, error, mensagem }` com códigos diferenciados (AC2)
- [x] Adicionar `console.error` com stack para `FALHA_TECNICA` (AC2)
- [ ] Verificar consistência entre campos diretos e entidades normalizadas após arquivamento (AC6)

### Fase 4 — Implementação frontend

- [x] `PipelineBoardClient.tsx`: adicionar handler `onCardExcluido(cardId)` que remove o card do estado local (AC1)
- [x] `CardFullViewModal.tsx`: repassar `onCardExcluido` ao `CardAbertoLayout` para acionar a remoção local após sucesso (AC1)
- [x] `PipelineBoardClient.tsx`: adicionar polling de fallback com `ListarCardsPipelineBpm` a cada 30s e ao retomar a aba (AC1)
- [x] `CardAbertoLayout.tsx`: mapear código de erro para mensagem específica no toast (AC2)
- [x] `CardAbertoLayout.tsx`: após sucesso, chamar callback de remoção local no board (AC1)
- [x] Board: separar estados `loading` / `error` / `empty` / `success` para a lista de cards (AC5)

### Fase 5 — Testes comportamentais

- [ ] `tests/bpm/excluir-card-action.test.ts`: adicionar caso de erro de dependência (`DEPENDENCIA_EXISTENTE`) (AC2, AC4)
- [ ] `tests/bpm/excluir-card-action.test.ts`: adicionar caso de falha técnica (`FALHA_TECNICA`) com `console.error` chamado (AC2, AC4)
- [ ] `tests/bpm/excluir-card-action.test.ts`: adicionar caso de exclusão concorrente (idempotência) (AC4)
- [ ] `tests/bpm/excluir-card-action.test.ts`: adicionar caso de consistência campos diretos vs. entidades normalizadas (AC6)
- [ ] `tests/bpm/excluir-card.test.ts`: atualizar assertions para refletir novo formato de retorno (código + mensagem) (AC2)
- [ ] `tests/bpm/board-exclusao-local.test.ts` (novo): testar que `PipelineBoardClient` remove card do estado local ao receber `onCardExcluido` sem depender de Pusher (AC1, AC4)
- [ ] `tests/bpm/exclusao-erros-diferenciados.test.ts` (novo): testes de cada código de erro com mocks específicos (AC2)

### Fase 6 — Forge (gates técnicos)

- [ ] `npx tsc --noEmit` — zero erros de tipo
- [ ] `npm run lint` — zero warnings críticos
- [ ] `npm test` — todos os testes passando
- [ ] `npm run build` — build completa sem erros

### Fase 7 — Probe (integração ponta a ponta)

- [ ] Presença visual: botão de exclusão aparece no card (board) e no `CardFullViewModal`
- [ ] Trigger funcionando: clique no botão abre `AlertDialog` com confirmação
- [ ] Rota acessível e protegida: `ExcluirCardBpm` exige `auth()` + `exigirAcessoBpmCard`
- [ ] Permissões configuradas: `excluirCard` em `PERMISSOES_POR_ROLE` (RESPONSAVEL/ADMINISTRADOR)
- [ ] Persistência de dados: card arquivado (`status: "ARQUIVADO"`) não aparece no board
- [ ] Estados da UI: loading, error, empty, success — todos distintos
- [ ] Integrações externas testadas: Pusher (fallback), `revalidatePath`
- [ ] Sem regressões em features existentes: mover card, criar card, listar cards

### Fase 8 — Anubis (segurança) + Lens (revisão)

- [ ] Anubis: auditar `ExcluirCardBpm` — `auth()` antes de qualquer operação; ownership check por `userId`; Zod validation; detalhes internos apenas em log
- [ ] Lens: revisão de código — imports absolutos, padrão do projeto, sem duplicidade

---

## File list

A ser preenchida por cada fase de execução com os arquivos efetivamente tocados.

### Fase 2 (story)

- [x] `docs/stories/story-rm-2026-b2f97b-confiabilidade-exclusao-crm.md` (este arquivo)

### Fase 3 (backend)

- [ ] `src/lib/validations/bpm.ts`
- [ ] `src/actions/bpm/Cards.ts`

### Fase 4 (frontend)

- [ ] `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- [ ] `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`

### Fase 5 (testes)

- [ ] `tests/bpm/excluir-card-action.test.ts`
- [ ] `tests/bpm/excluir-card.test.ts`
- [ ] `tests/bpm/board-exclusao-local.test.ts` (novo)
- [x] `tests/bpm/exclusao-modal-board-react.test.ts` (novo)
- [ ] `tests/bpm/exclusao-erros-diferenciados.test.ts` (novo)

### Fase 6–8 (gates, segurança, revisão)

- [ ] `.bibble/memory/decisions.md`
- [ ] `.bibble/memory/known-errors.md`
- [ ] `.bibble/memory/architecture.md`

---

## Restrições

- **NÃO** inventar critérios além dos itens 4–10 do objetivo e do blueprint da Fase 1.
- **NÃO** executar migration ou alteração de schema sem aprovação específica registrada (AGENTS.md — Database Safety).
- **NÃO** expor detalhes internos (stack, query, IDs internos) na resposta ao cliente — somente em `console.error` server-side.
- **NÃO** confiar em role/permissão vinda do cliente — sempre revalidar no servidor via `exigirAcessoBpmCard`.
- **NÃO** duplicar regra de negócio — `ExcluirCardBpm` é o único comando canônico de exclusão.
- **NÃO** substituir `onDelete: Restrict` por `Cascade` sem justificativa documentada em `decisions.md`.

---

## Sinais de autoajuste (herdados da Fase 0)

| # | AUTO_ADJUSTMENT_REQUIRED | AUTO_ADJUSTMENT_ACCEPTANCE |
|---|--------------------------|---------------------------|
| 1 | Board não remove card do estado local após exclusão; depende exclusivamente de Pusher ou refetch manual | `PipelineBoardClient.tsx` remove card do estado local ao receber callback de exclusão bem-sucedida; teste cobre o caso sem Pusher |
| 2 | Action retorna strings genéricas; não há códigos de erro distintos | Action retorna `{ success, error: <código>, mensagem }`; UI mapeia código para mensagem; detalhes técnicos apenas em `console.error` |
| 3 | Testes não cobrem explicitamente: atualização sem Pusher, falha de transporte, exclusão concorrente | Três testes nomeados explicitamente cobrindo cada caso; todos passam em `npm test` |
| 4 | Board não separa estados `error` e `empty` no estado de cards | `PipelineBoardClient.tsx` distingue os três estados (loading, error, empty); teste de renderização cobre cada estado |

**Todos os itens acima devem ser implementados e testados antes de considerar a story pronta.**

---

## DELIVERY_READY

`docs/stories/story-rm-2026-b2f97b-confiabilidade-exclusao-crm.md` — story completa, pronta para implementação nas Fases 3–8. Consumida pelo executor das Fases 3–8 (mesmo motor, mesma sequência RM-2026-B2F97B).

## Revisão de execução — 2026-09-23

- O board remove o card localmente após a confirmação da action. A falha de transporte do Pusher não desfaz o arquivamento já confirmado; a revalidação do caminho continua ocorrendo. O carregamento distingue erro de lista vazia.
- `ExcluirCardBpm` valida o identificador com o schema canônico, revalida a autorização dentro da transação e retorna códigos distintos para falta de permissão, restrição relacional (`P2003`/`P2014`) e falha técnica. Detalhes internos ficam no log do servidor.
- A edição e a movimentação sincronizam o próximo contato do card com `BpmCardFollowUpEstado` na mesma transação. Agendamento e reagendamento sincronizam os campos diretos da reunião com `BpmCardReuniao` na mesma transação. O arquivamento altera apenas o status e preserva as relações.
- Testes em SQLite descartável verificam rollback de auditoria, preservação de dependências e igualdade entre campos diretos e registros relacionados após arquivamento. Testes de action cobrem ausência de Pusher, falha de transporte, repetição da exclusão e códigos de erro. Testes de agendamento e autosave conferem as gravações normalizadas.
- Gates locais em cópia isolada: 1.128/1.128 testes BPM, verificação de tipos, lint direcionado e build de produção aprovados. O teste visual autenticado no navegador permanece para a etapa Testes.
- O polling entre sessões sem Pusher foi adicionado posteriormente: o board visível consulta a lista a cada 30 segundos e ao retomar a aba. O polling pausa durante arrasto ou atualização manual; uma resposta iniciada antes da exclusão local não pode recolocar o card no board. `tests/bpm/board-polling-react.test.ts` exercita o board real com Pusher ausente e a limpeza do intervalo ao desmontar. Homologação com duas sessões autenticadas continua para Testes.
