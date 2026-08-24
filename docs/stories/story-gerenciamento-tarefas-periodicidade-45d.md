# Story: Periodicidade 45D no Gerenciamento de Tarefas

**ID:** STORY-TAREFAS-PERIODICIDADE-45D  
**Módulo:** Gerenciamento de Tarefas  
**Status:** Ready for Review  
**Prioridade:** Média  
**Data de criação:** 2026-08-24  

## Narrativa

**Como** usuário responsável pelo gerenciamento de tarefas,  
**quero** escolher a periodicidade `45D` ao criar ou editar uma tarefa,  
**para** programar tarefas recorrentes a cada 45 dias usando o mesmo fluxo das periodicidades existentes.

## Critérios de Aceitação

- [x] **AC-001:** O seletor de periodicidade exibe `45D` junto de `Única`, `Rotina`, `10D`, `15D` e `30D`.
- [x] **AC-002:** Selecionar `45D` define `intervaloDias` como `45` e mantém a tarefa recorrente.
- [x] **AC-003:** A criação e a edição enviam e restauram o valor `45` pelo fluxo existente, sem alteração de schema ou migration.
- [x] **AC-004:** As periodicidades existentes mantêm o comportamento atual.
- [x] **AC-005:** Os gates de lint, TypeScript e testes do projeto são executados e os resultados registrados.

## Tasks / Subtasks

- [x] **Task 1 — Adicionar a opção 45D** (AC: 1–4)
  - [x] Incluir a opção visual com valor numérico `45` no catálogo existente do modal.
  - [x] Confirmar seleção, criação e restauração em edição pelo contrato genérico de `intervaloDias`.
- [x] **Task 2 — Validar** (AC: 5)
  - [x] Executar verificação focal do arquivo alterado.
  - [x] Executar `npm run typecheck`, `npm run lint` e `npm test`.

## Dev Notes

- O catálogo de periodicidades está em `src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx`.
- `src/actions/Tarefas.ts` já aceita `intervaloDias?: number | null` tanto na criação quanto na edição, sem enum fechado.
- `prisma/schema.prisma` já persiste `intervaloDias` como `Int?`; não há mudança estrutural de banco.
- A recorrência diária usa numericamente `intervaloDias`, portanto `45` segue o mesmo precedente de `10`, `15` e `30`.

## File List

| Arquivo | Ação prevista |
|---|---|
| `src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx` | Adicionar `45D` ao catálogo de periodicidades |
| `docs/stories/story-gerenciamento-tarefas-periodicidade-45d.md` | Acompanhar implementação e gates |

## CodeRabbit Integration

- **Tipo:** Frontend
- **Complexidade:** Baixa
- **Agentes:** `@dev`, com validação de `@qa`
- **Foco:** valor exato `45`, ausência de regressão nas opções atuais e acessibilidade do botão.
- **Self-healing:** `@dev` light, até 2 iterações para issues CRITICAL.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-08-24 | 1.0 | Story criada e preparada para desenvolvimento | River (SM) |
| 2026-08-24 | 1.1 | Opção 45D adicionada e gates executados | Nova / Forge |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `git diff --check -- src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx` — aprovado.
- `npx tsc --noEmit` — mudança focal limpa; falhou por baselines preexistentes em Exclusão Fiscal, Habilitação Radar, Roadmap Production e teste do Google Calendar.
- `npx eslint src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx` — apontou 11 erros e 12 avisos preexistentes no componente legado; nenhuma ocorrência está na linha alterada.
- `npm test` — 1711/1717 testes aprovados; seis falhas preexistentes e não relacionadas.
- `npm run build` — aprovado; 76 páginas estáticas geradas e rota de Gerenciamento de Tarefas compilada.

### Completion Notes List

- Adicionada a opção `45D` com valor `45` ao catálogo existente.
- Grade desktop ampliada de cinco para seis colunas para acomodar todas as periodicidades sem quebra adicional.
- Backend e schema permaneceram inalterados porque o contrato já aceita qualquer `Int?`.

## QA Results

- Build aprovado. Typecheck, lint e testes mantêm baselines preexistentes sem ocorrência nas linhas alteradas; ver Debug Log References.
