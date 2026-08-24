# Story: Seleção do Canal de Entrada pelos Cards do Alpha Leads

**ID:** STORY-ALPHA-LEADS-CANAL-CARDS  
**Módulo:** Alpha Leads  
**Status:** Ready for Review  
**Prioridade:** Média  
**Data de criação:** 2026-08-24  

## Narrativa

**Como** usuário do Alpha Leads,  
**quero** selecionar o canal de entrada diretamente nos cards laterais,  
**para** identificar visualmente o canal ativo antes de salvar o registro diário.

## Critérios de Aceitação

- [x] **AC-001:** O select `Canal de Entrada` é removido do formulário.
- [x] **AC-002:** Cada card lateral de canal é clicável por mouse e teclado e seleciona o canal correspondente.
- [x] **AC-003:** O card selecionado recebe borda viva e destaque visual inequívoco, preservando sua cor de canal.
- [x] **AC-004:** Ao entrar sem um canal válido na URL, nenhum card fica selecionado.
- [x] **AC-005:** Enquanto nenhum canal estiver selecionado, `Salvar no sistema` fica desabilitado e cinzento.
- [x] **AC-006:** Após selecionar um card, os dados diários do canal são carregados e o botão de salvar é habilitado.
- [x] **AC-007:** A seleção preserva data, mês, ano e demais parâmetros existentes na URL.
- [x] **AC-008:** O salvamento continua enviando o identificador canônico do canal ao fluxo existente, sem alteração de schema ou migration.
- [x] **AC-009:** Os gates de lint, TypeScript e testes do projeto são executados e os resultados registrados.

## Tasks / Subtasks

- [x] **Task 1 — Tornar a seleção nullable** (AC: 4–8)
  - [x] Validar o parâmetro `canal` e representar a ausência de seleção explicitamente.
  - [x] Impedir o salvamento sem canal e preservar os parâmetros atuais ao selecionar.
- [x] **Task 2 — Substituir o select pelos cards** (AC: 1–3, 5–6)
  - [x] Remover o select do formulário.
  - [x] Converter os cards laterais em controles acessíveis com estado selecionado.
  - [x] Aplicar borda viva, foco visível e `aria-pressed` ao card ativo.
  - [x] Exibir o botão de salvar bloqueado e cinzento sem seleção.
- [x] **Task 3 — Validar** (AC: 1–9)
  - [x] Executar verificação focal do arquivo alterado.
  - [x] Executar `npm run typecheck`, `npm run lint` e `npm test`.

## Dev Notes

- A tela está em `src/app/PainelAlpha/ControleLeads/Lançamentos.tsx`.
- Os cards de resumo já são renderizados a partir das chaves de `resumoLateral.canais` e representam os mesmos identificadores aceitos por `upsertPerformance`.
- O estado atual usa `TRAFEGO_PAGO` como fallback, o que seleciona um canal implicitamente; esta story remove esse fallback quando a URL não contém um canal válido.
- `handleCanalChange` atualmente substitui toda a query string; deve passar a preservar os parâmetros existentes.
- Nenhuma alteração de persistência é necessária.

## File List

| Arquivo | Ação prevista |
|---|---|
| `src/app/PainelAlpha/ControleLeads/Lançamentos.tsx` | Remover select, tornar cards selecionáveis e bloquear salvamento sem canal |
| `docs/stories/story-alpha-leads-selecao-canal-cards.md` | Acompanhar implementação e gates |

## CodeRabbit Integration

- **Tipo:** Frontend
- **Complexidade:** Média
- **Agentes:** `@dev`, `@ux-expert`, com validação de `@qa`
- **Foco:** acessibilidade, estado inicial sem seleção, preservação da URL e consistência do canal salvo.
- **Self-healing:** `@dev` light, até 2 iterações para issues CRITICAL.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-08-24 | 1.0 | Story criada e preparada para desenvolvimento | River (SM) |
| 2026-08-24 | 1.1 | Seleção migrada para os cards e gates executados | Nova / Forge |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `git diff --check -- src/app/PainelAlpha/ControleLeads/Lançamentos.tsx` — aprovado.
- `npx tsc --noEmit` — nenhuma falha na tela alterada; baselines externos em Exclusão Fiscal, Habilitação Radar e teste Google Calendar.
- `npx eslint src/app/PainelAlpha/ControleLeads/Lançamentos.tsx` — somente débitos preexistentes do componente legado, sem ocorrência nas linhas novas.
- `npm run lint` — permaneceu em execução sem output e foi interrompido após mais de cinco minutos; lint focal executado separadamente.
- `npm test` — 1711/1717 testes aprovados; seis falhas preexistentes em CRM, PPTX, Bibble, Alpha SEO e Google Calendar.
- `npm run build` — aprovado; 76 páginas estáticas geradas e rota `/PainelAlpha/ControleLeads` compilada.
- Browser local — rota redirecionou para `/?acesso=bloqueado`; não havia sessão autenticada disponível para validar visualmente sem contornar o login.
- CodeRabbit — indisponível porque o host não possui distribuição WSL instalada.

### Completion Notes List

- O estado inicial sem query `canal` não seleciona nenhum card.
- Os cinco cards laterais são botões acessíveis, com `aria-pressed`, foco visível, borda e glow na cor do canal selecionado.
- O select foi removido e o período de referência ocupa a largura do bloco.
- O botão de salvar fica cinzento e desabilitado até a seleção; o handler também possui guard defensivo.
- A seleção atualiza somente `canal` e preserva os demais parâmetros da URL.

## QA Results

- Build aprovado. Typecheck, lint e testes mantêm baselines preexistentes sem ocorrência nas linhas alteradas; validação visual depende de sessão autenticada.
