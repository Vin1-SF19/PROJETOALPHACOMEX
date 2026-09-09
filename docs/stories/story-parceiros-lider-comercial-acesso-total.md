# Story: Acesso total de Lider Comercial ao modulo Parceiros

**ID:** STORY-PARCEIROS-LIDER-COMERCIAL-ACESSO-TOTAL  
**Modulo:** Parceiros  
**Status:** Ready for Review  
**Prioridade:** Alta  
**Tipo:** Seguranca / Frontend / Backend  
**Data de criacao:** 2026-09-09

## Story

**Como** usuario com role `Lider Comercial`,  
**quero** ter no modulo Parceiros as mesmas permissoes de Admin/CEO,  
**para que** eu possa executar todas as acoes administrativas do modulo, inclusive **Atualizar termo**.

## Acceptance Criteria

- [ ] **AC-001 — Entrada no modulo:** `Lider Comercial` visualiza e acessa o modulo Parceiros mesmo sem permissao individual adicional.
- [ ] **AC-002 — Contexto administrativo:** No contexto exclusivo de Parceiros, `Lider Comercial` recebe as mesmas capacidades de Admin/CEO.
- [ ] **AC-003 — Atualizar termo:** O menu **Acoes** exibe **Atualizar termo** e permite listar historico, ler versoes e publicar uma nova versao.
- [ ] **AC-004 — Demais acoes:** Controles administrativos do modulo que dependem de `isAdmin` tambem ficam disponiveis para `Lider Comercial`.
- [ ] **AC-005 — Isolamento:** A role nao recebe bypass administrativo global fora do modulo Parceiros.
- [ ] **AC-006 — Sem banco:** A mudanca nao altera schema, migrations ou dados persistidos.
- [ ] **AC-007 — Regressao:** Admin, CEO e TI preservam o comportamento atual.

## Tasks / Subtasks

- [x] **Task 1 — Centralizar a role administrativa de Parceiros** (AC: 2, 4, 5, 7)
  - [x] Criar um helper especifico do modulo que inclua `Lider Comercial` sem alterar `isAdminRole` global.
  - [x] Aplicar o helper aos contextos de `parceiros.ts` e `convites-parceiro.ts`.
- [x] **Task 2 — Liberar navegacao e realtime** (AC: 1, 3, 4)
  - [x] Declarar `Lider Comercial` como role permitida na entrada de Parceiros.
  - [x] Autorizar a role no canal privado de pre-cadastros sem ampliar o canal administrativo de Chamados.
  - [x] Exibir a role como acesso total no controle de acesso do modulo.
- [x] **Task 3 — Testar e validar** (AC: 1–7)
  - [x] Cobrir o helper especifico e seu isolamento do bypass global.
  - [x] Cobrir o contexto server-side e a presenca do acesso na interface/registry.
  - [x] Executar lint, typecheck e testes.

## Dev Notes

- O contexto principal do modulo nasce em `getCtx()` e propaga `isAdmin` para a UI e para as actions. [Source: `src/actions/parceiros.ts`]
- Convites e configuracoes possuem contexto local proprio e precisam usar a mesma regra. [Source: `src/actions/convites-parceiro.ts`]
- A visibilidade do modulo e resolvida pelo registry com `allowedRoles`. [Source: `src/lib/modulos-registry.ts`]
- O canal de pre-cadastros compartilha hoje a verificacao dos canais administrativos. [Source: `src/app/api/pusher/auth/route.ts`]
- Nao ha mudanca de banco; Vault nao e acionado.

## Testing

| Cenario | Resultado esperado |
|---|---|
| Lider Comercial | Acesso total apenas em Parceiros |
| Admin/CEO/TI | Comportamento atual preservado |
| User comum | Nao recebe acesso administrativo por role |
| Canal de pre-cadastros | Lider Comercial autorizado |
| Canal admin de Chamados | Regra global permanece inalterada |

## CodeRabbit Integration

- **Primary Type:** Security
- **Secondary Types:** Frontend, API
- **Complexity:** Media
- **Primary Agent:** `@dev`
- [ ] Pre-Commit: revisar isolamento da role ao modulo Parceiros.
- [ ] Pre-PR: validar ausencia de ampliacao global de privilegios.
- **Self-healing:** `@dev` light, 2 iteracoes, 15 minutos, CRITICAL `auto_fix`, HIGH `document_only`.

## Change Log

| Data | Versao | Descricao | Autor |
|---|---:|---|---|
| 2026-09-09 | 1.0 | Story criada e preparada para desenvolvimento | River (SM) |
| 2026-09-09 | 1.1 | Acesso total de Lider Comercial implementado e validado | Dex (Dev) |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/auth/ti-admin-access.test.ts tests/parceiros/lider-comercial-acesso-total.test.ts --coverage=false` — 31/31 testes aprovados.
- ESLint focado nos arquivos alterados — aprovado.
- `npm run build` — aprovado, 78 paginas geradas.
- `npm test` — baseline global com 50 falhas fora do escopo; os testes desta story passaram.
- `npm run typecheck` — baseline global com erros fora do escopo em ExclusaoFiscal, Gerador de Documentos, Agenda Alpha e Habilitacao Radar.
- `npm run lint` — baseline global invalido por incluir `.agents`, `.aiox-core` e erros preexistentes da aplicacao.
- CodeRabbit CLI indisponivel no ambiente.

### Completion Notes List

- `Lider Comercial` recebe acesso total somente dentro do modulo Parceiros.
- O botao **Atualizar termo**, historico, publicacao, configuracoes, convites e demais verificacoes `isAdmin` do modulo passam a reconhecer a role.
- A entrada do modulo e o canal realtime de pre-cadastros tambem foram liberados.
- `isAdminRole` global permanece inalterado, evitando elevacao de privilegio em outros modulos.
- Nenhuma alteracao de banco foi realizada.

### File List

- `src/lib/roles.ts`
- `src/lib/modulos-registry.ts`
- `src/actions/parceiros.ts`
- `src/actions/convites-parceiro.ts`
- `src/components/Parceiros/ModalEngrenagem.tsx`
- `src/app/api/pusher/auth/route.ts`
- `tests/auth/ti-admin-access.test.ts`
- `tests/parceiros/lider-comercial-acesso-total.test.ts`
- `docs/stories/story-parceiros-lider-comercial-acesso-total.md`

## QA Results
