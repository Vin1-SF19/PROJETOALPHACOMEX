# Story: Corrigir escala de recorrência e modal de login do parceiro

**ID:** STORY-PARCEIROS-RECORRENCIA-LOGIN-RESPONSIVO
**Módulo:** Parceiros
**Status:** Ready
**Prioridade:** Alta
**Data de criação:** 2026-09-14

## Executor Assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["eslint", "typescript", "vitest", "next-build", "coderabbit"]

## Narrativa

**Como** usuário do Painel Alpha,
**quero** visualizar uma escala correta de cinco estrelas no potencial de recorrência e acessar todo o conteúdo do modal “Ver login” em qualquer tamanho de tela,
**para** avaliar o parceiro e consultar suas credenciais sem elementos excedentes ou conteúdo inacessível.

## Critérios de Aceitação

- [ ] **AC-001 — Cinco estrelas:** No detalhe do parceiro, “Potencial de recorrência” exibe exatamente cinco estrelas, correspondentes aos valores de 1 a 5.
- [ ] **AC-002 — Persistência da escala:** Clicar em uma estrela continua salvando um valor válido entre 1 e 5 e mantém o destaque visual coerente com o valor salvo.
- [ ] **AC-003 — Modal responsivo:** O modal aberto por “Ver login” cabe na largura e na altura útil de telas pequenas, preservando margens externas.
- [ ] **AC-004 — Conteúdo acessível:** Quando o conteúdo excede a altura disponível, o corpo do modal permite rolagem sem ocultar login, senha, mensagem ou ação de concluir.
- [ ] **AC-005 — Conteúdo longo:** Login, nome do parceiro, senha e mensagem longos quebram linha sem ampliar o modal além da viewport.
- [ ] **AC-006 — Sem mudança de banco:** A correção é exclusivamente de interface e não altera schema, migration ou dados.

## Tasks / Subtasks

- [x] **Task 1 — Corrigir escala de recorrência** (AC: 1, 2)
  - [x] Renderizar somente os valores de 1 a 5 no detalhe do parceiro.
  - [x] Preservar salvamento e destaque visual do potencial selecionado.

- [x] **Task 2 — Tornar modal de credenciais responsivo** (AC: 3–5)
  - [x] Limitar largura e altura do conteúdo à viewport com margens adequadas.
  - [x] Permitir rolagem vertical interna quando necessária.
  - [x] Garantir quebra de linha nos valores e textos dinâmicos.

- [ ] **Task 3 — Testes e quality gates** (AC: 1–6)
  - [x] Adicionar regressão automatizada para a escala e as classes responsivas essenciais.
  - [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Dev Notes

- Story corretiva independente, criada a partir de defeitos relatados diretamente pelo usuário; não pertence a um epic e não depende de outra story.
- A escala do detalhe está em `src/components/Parceiros/Relacionamento360Section.tsx` e atualmente renderiza os valores de 0 a 5, resultando em seis estrelas. [Source: `src/components/Parceiros/Relacionamento360Section.tsx`]
- O modal aberto por “Ver login” reutiliza `ModalCredenciais`, cujo conteúdo ainda não possui limite de altura nem rolagem explícita para viewports pequenas. [Source: `src/components/Parceiros/DetalheParceiroClient.tsx`; `src/components/Parceiros/ModalCredenciais.tsx`]
- Não foram encontrados documentos de arquitetura nos caminhos configurados; esta story usa somente o comportamento real dos componentes afetados e o requisito fornecido pelo usuário.
- Não há alteração de banco no escopo.

## Testes Esperados

- **Framework:** Vitest.
- **Local:** `tests/parceiros/detalhe-ui.test.ts`.
- **Abordagem:** teste estrutural dos componentes, seguindo o padrão de regressões de UI existente no repositório, complementado pelos gates globais do projeto.

| Cenário | Resultado esperado |
|---|---|
| Abrir detalhe com potencial entre 1 e 5 | Exatamente cinco estrelas; preenchimento representa o valor salvo |
| Selecionar uma estrela | Valor correspondente entre 1 e 5 é enviado para salvamento |
| Abrir “Ver login” em viewport pequena | Modal permanece dentro da tela e seu conteúdo pode ser rolado |
| Exibir login, parceiro ou mensagem longos | Texto quebra linha sem provocar overflow horizontal |

## File List

| Arquivo | Ação prevista |
|---|---|
| `src/components/Parceiros/Relacionamento360Section.tsx` | Corrigir a escala para cinco estrelas |
| `src/components/Parceiros/ModalCredenciais.tsx` | Ajustar limites, rolagem e quebra de conteúdo do modal |
| `tests/parceiros/detalhe-ui.test.ts` | Cobrir as regressões visuais estruturais |
| `docs/stories/story-parceiros-recorrencia-login-responsivo.md` | Rastrear implementação e validações |
| `.ai/story-validation-parceiros-recorrencia-login-responsivo.json` | Registrar validação PO da story |
| `plan/self-critique-parceiros-recorrencia-login-responsivo.json` | Registrar autocrítica obrigatória |
| `docs/qa/coderabbit-reports/story-parceiros-recorrencia-login-responsivo.md` | Registrar indisponibilidade do CodeRabbit |

## CodeRabbit Integration

### Story Type Analysis

- **Tipo primário:** Frontend
- **Tipos secundários:** Nenhum
- **Complexidade:** Baixa — dois componentes existentes, sem novo contrato ou persistência.

### Specialized Agent Assignment

- **Agente primário:** `@dev`
- **Agente especializado:** `@ux-expert`, para consistência responsiva e acessibilidade.
- **Apoio:** `@github-devops` somente se houver criação de PR.

### Quality Gate Tasks

- [ ] **Pre-Commit (`@dev`):** executar CodeRabbit sobre alterações não commitadas antes de concluir a story.
- [ ] **Pre-PR (`@github-devops`):** executar CodeRabbit comparando com `main`, caso seja criado PR.
- **Pre-Deployment:** não aplicável; a story não executa deployment.

### Self-Healing Configuration

- **Modo:** light (`@dev`)
- **Máximo:** 2 iterações, 15 minutos, filtro somente CRITICAL.
- **Comportamento:** CRITICAL recebe tentativa de correção automática; HIGH é documentado; MEDIUM e LOW não bloqueiam esta etapa.

### Focus Areas

- Responsividade mobile-first, limites pela viewport e rolagem interna.
- Quebra de textos dinâmicos e prevenção de overflow horizontal.
- Acessibilidade dos controles e preservação do contrato de salvamento de 1 a 5.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-09-14 | 1.0 | Story criada a partir do relato do usuário | River (SM) |
| 2026-09-14 | 1.0.1 | Validated GO (9/10) — Status: Draft → Ready | @po |
| 2026-09-14 | 1.1.0 | Escala corrigida e modal de credenciais adaptado para telas pequenas | Dex (Dev) |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/parceiros/detalhe-ui.test.ts --coverage=false` — 2/2 testes aprovados.
- `npx eslint src/components/Parceiros/Relacionamento360Section.tsx src/components/Parceiros/ModalCredenciais.tsx tests/parceiros/detalhe-ui.test.ts` — aprovado.
- `npm run build` — aprovado; aplicação compilada e 78 páginas geradas.
- `npm run typecheck` — bloqueado por erros preexistentes em Exclusão Fiscal, Gerador de Documentos, Habilitação Radar, Calendar e testes do Calendar; nenhum erro nos arquivos desta story.
- `npm run lint` — bloqueado pelo baseline global (204.277 ocorrências), incluindo varredura de `.agents` e `.aiox-core`; lint focado aprovado.
- `npm test` — 2.880 aprovados, 28 falhas preexistentes em 14 arquivos; `tests/parceiros/detalhe-ui.test.ts` aprovado.
- `docs/qa/coderabbit-reports/story-parceiros-recorrencia-login-responsivo.md` — CodeRabbit indisponível por ausência de WSL e binário nativo.
- Checklist DoD — implementação, teste focado e build aprovados; conclusão formal bloqueada pelos gates globais e CodeRabbit indisponível.

### Completion Notes List

- “Potencial de recorrência” agora renderiza cinco estrelas, correspondentes aos valores 1 a 5; valor nulo/zero continua representado sem estrelas preenchidas.
- O modal de credenciais respeita margens, largura e altura da viewport, habilita rolagem vertical e impede overflow horizontal.
- Login, nome do parceiro e mensagem configurável passam a quebrar linha quando extensos.
- Foi adicionada regressão Vitest para a quantidade de estrelas, contrato de clique e classes essenciais de responsividade.
- Nenhuma alteração de banco, API, autenticação ou dependência foi realizada.
- A story permanece em `Ready`, sem transição para review, porque os quality gates globais do repositório não estão verdes.

## QA Results

_A preencher pela validação de qualidade._
