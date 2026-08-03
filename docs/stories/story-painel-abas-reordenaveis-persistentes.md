# Story — Abas reordenáveis e persistentes no Painel Alpha

## Status

Review

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["eslint", "typescript", "vitest", "next-build"]

## Story

Como usuário do Painel Alpha, quero reorganizar as abas abertas conforme meu uso e recuperar essa organização ao retornar ao painel, para manter os módulos mais importantes na ordem que faz sentido para o meu trabalho.

## Acceptance Criteria

1. As abas de módulos podem ser reordenadas horizontalmente por arrastar e soltar com mouse ou toque.
2. A reordenação também funciona por teclado e expõe instruções adequadas às tecnologias assistivas.
3. A aba fixa `IAlpha` permanece sempre na primeira posição e não pode ser arrastada, fechada ou deslocada por outra aba.
4. A ordem, as abas abertas e a aba ativa são restauradas depois de fechar/reabrir a página e depois de sair/entrar novamente no mesmo navegador.
5. O estado persistido é isolado por `userId`, impedindo que usuários diferentes do mesmo navegador compartilhem a lista de abas.
6. Dados persistidos inválidos, duplicados ou incompletos são normalizados com segurança; se não houver estado válido, o painel inicia com `IAlpha` e a rota atual.
7. Ativar e fechar abas continuam funcionando sem regressão, inclusive após uma reordenação.
8. A melhoria não exige banco, migration, nova rota, nova permissão ou alteração no registry de módulos.
9. Durante o arraste, a aba permanece alinhada verticalmente à barra e não é recortada pelo container de rolagem.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type:** Frontend  
**Secondary Type(s):** Architecture  
**Complexity:** Medium — estado persistido, interação drag-and-drop e acessibilidade em componentes globais do layout.

### Specialized Agent Assignment

**Primary Agents:**

- @dev
- @ux-expert

**Supporting Agents:**

- @qa

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): revisar acessibilidade, persistência e regressões do layout.
- [ ] Pre-PR (@github-devops): revisar integração e compatibilidade com as abas existentes.

### Self-Healing Configuration

**Expected Self-Healing:**

- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL

**Predicted Behavior:**

- CRITICAL: auto-fix.
- HIGH: documentar sem correção automática.

### CodeRabbit Focus Areas

- WCAG 2.1 AA: semântica, foco, navegação por teclado e nomes acessíveis.
- Compatibilidade entre clique, fechamento e gesto de arrastar.
- Validação defensiva de dados vindos do `localStorage`.
- Isolamento do estado persistido por usuário autenticado.

## Tasks / Subtasks

- [x] Task 1 — Centralizar e endurecer a persistência das abas (AC: 3–6, 8)
  - [x] Criar tipos/helpers puros para normalização, leitura e chave por usuário.
  - [x] Restaurar e salvar ordem, abas abertas e aba ativa somente após a hidratação.
- [x] Task 2 — Implementar reordenação acessível no `TabBar` (AC: 1–3, 7)
  - [x] Reutilizar `@dnd-kit` e o padrão sortable já adotado no projeto.
  - [x] Preservar `IAlpha` fixa e separar corretamente as ações de ativar, arrastar e fechar.
- [x] Task 3 — Cobrir regras puras com testes (AC: 3–6)
  - [x] Testar chave por usuário, normalização, duplicatas, aba fixa e payload inválido.
- [x] Task 4 — Validar e documentar a entrega (AC: 1–8)
  - [x] Atualizar mapas de componentes/integração e a File List.
  - [x] Executar lint, typecheck, testes e build.
- [x] Task 5 — Corrigir recorte vertical durante o arraste (AC: 9)
  - [x] Restringir visualmente a transformação sortable ao eixo horizontal.
  - [x] Validar lint e testes; registrar impedimento ambiental do build com `next dev` ativo.

## Dev Notes

- `PainelLayoutClient.tsx` já mantém uma iframe montada por aba e contém uma persistência inicial em `localStorage`; a mudança deve evoluir esse fluxo, não criar um segundo gerenciador paralelo. [Source: `.bibble/memory/codebase-map.md#Notas-de-arquitetura-importantes`]
- `TabBar.tsx` e `PainelLayoutClient.tsx` ficam em `src/components/layout/` e consomem `MODULOS_REGISTRY` como fonte única de metadados dos módulos. [Source: `.bibble/memory/codebase-map.md#Estrutura-de-Arquivos-principais`]
- O projeto já usa `@dnd-kit` com `useSortable` e `arrayMove` na lista de slides e no Kanban; a implementação deve seguir esse precedente. [Source: `.bibble/memory/components.md#Módulo-Alpha-Presentation-Studio—Editor`]
- Persistência pedida é local ao mesmo navegador. Sincronização entre navegadores/dispositivos exigiria persistência de servidor e não faz parte desta story.
- Nenhuma mudança de banco é necessária; Vault não se aplica.

### Testing

- Testes puros em `tests/layout/painel-tabs.test.ts`, executados pelo Vitest no ambiente Node.
- Cenários manuais recomendados: arrastar com ponteiro, reordenar com teclado, fechar/ativar após arraste, reload e logout/login no mesmo navegador.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-03 | 1.0 | Story criada a partir do pedido do usuário e do reconhecimento do layout existente. | River |
| 2026-08-03 | 1.1 | Reordenação acessível e persistência isolada por usuário implementadas e validadas. | Dex |
| 2026-08-03 | 1.2 | Transformação do item arrastado restrita ao eixo horizontal para impedir recorte visual. | Nova |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx eslint src/components/layout/TabBar.tsx src/components/layout/PainelLayoutClient.tsx src/lib/painel-tabs.ts tests/layout/painel-tabs.test.ts` — passou.
- `npx vitest run tests/layout/painel-tabs.test.ts` — 6/6 testes passaram.
- `npx tsc --noEmit` — encontrou apenas erros preexistentes fora desta story em arquivos gerados, Radar, Colaboradores e Google Calendar.
- `npm run lint` — o lint global varreu `.agents`, `.aiox-core` e worktrees internas e falhou em dívida preexistente; o escopo alterado passou no lint direcionado.
- `npm run build` — passou, 68 páginas estáticas geradas.
- `npm test` — 593/594 passaram; um teste preexistente de Google Calendar excedeu o timeout de 5 s.
- `npm run lint -- src/components/layout/TabBar.tsx` — passou após a correção visual.
- `npm run typecheck` — manteve somente os erros preexistentes já listados, sem erro em `TabBar.tsx`.
- `npm test` — repetido após a correção: 593/594 passaram; permaneceu apenas o mesmo timeout do Google Calendar.
- `npm run build` — nova tentativa bloqueada por `EPERM` no binário do Prisma enquanto um processo `next dev` externo estava ativo; o build completo anterior desta story passou.

### Completion Notes List

- Abas não fixadas podem ser reordenadas por ponteiro/toque ou teclado usando o padrão sortable já instalado.
- A aba `IAlpha` é normalizada como fixa, canônica e sempre primeira.
- Ordem, abas abertas e aba ativa são persistidas no `localStorage` somente após hidratação e em chave exclusiva por `userId`.
- Payloads externos, duplicados ou inválidos são descartados sem quebrar o layout.
- A ação de fechar passou a usar botão independente, evitando controle interativo aninhado.
- O item arrastado agora ignora deslocamento vertical (`y = 0`), permanecendo visível dentro da barra com overflow horizontal.
- Não houve alteração de banco, migration, rota ou permissão.

### File List

- `docs/stories/story-painel-abas-reordenaveis-persistentes.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/integration-points.md`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/components/layout/TabBar.tsx`
- `src/lib/painel-tabs.ts`
- `tests/layout/painel-tabs.test.ts`

## QA Results

_A preencher pelo agente de QA._
