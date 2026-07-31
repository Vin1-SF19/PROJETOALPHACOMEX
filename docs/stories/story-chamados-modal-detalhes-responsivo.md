# Story — Modal responsivo de detalhes do chamado

## Status

InProgress

## Story

Como usuário do módulo de Chamados, quero visualizar todos os detalhes de um chamado em um modal bem dimensionado, para que nenhum conteúdo ou ação fique cortado independentemente do tamanho da tela.

## Acceptance Criteria

1. O modal respeita a altura disponível da viewport e não ultrapassa os limites visíveis da tela.
2. Quando o conteúdo excede a altura disponível, o corpo do modal possui rolagem vertical.
3. Em telas grandes, o modal utiliza uma largura maior para reduzir o crescimento vertical desnecessário.
4. Cabeçalho, metadados, cartões e ações se reorganizam de forma responsiva em telas menores.
5. Textos longos não provocam corte ou overflow horizontal.
6. O fluxo existente de consulta e atualização do chamado permanece inalterado.

## Tasks / Subtasks

- [x] Task 1 — Corrigir dimensionamento do modal (AC: 1, 2, 3)
  - [x] Limitar a altura pela viewport dinâmica.
  - [x] Separar cabeçalho fixo e conteúdo rolável.
  - [x] Ampliar a largura máxima em breakpoints maiores.
- [x] Task 2 — Melhorar a responsividade interna (AC: 4, 5)
  - [x] Empilhar cabeçalho, cartões e botões quando não houver largura suficiente.
  - [x] Permitir quebra de linhas em títulos, descrições e soluções.
- [ ] Task 3 — Validar a entrega (AC: 1–6)
  - [x] Executar lint direcionado.
  - [ ] Executar typecheck.
  - [x] Executar testes.
  - [x] Executar build.

## Dev Notes

- A mudança é exclusivamente visual e não exige alteração de banco, dependências ou contratos de API.
- O modal usa o componente `Dialog` baseado em Radix UI e classes Tailwind.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-07-30 | 1.0 | Story criada e implementação responsiva iniciada. | Dex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx eslint src/components/DetalhesChamado.tsx` — passou.
- `npm run typecheck` — sem erros no modal; bloqueado por quatro erros preexistentes em `ExclusaoFiscal/route`, `ModalPerfilColaborador` e `HabilitacaoRadarClient`.
- `npm test` — 53 arquivos e 448 testes passaram.
- `npx next build` — build de produção passou.
- `npm run lint` — excedeu 180 segundos porque a configuração global percorre diretórios internos do framework; o arquivo alterado passou no lint direcionado.
- `git diff --check` — passou.

### Completion Notes List

- O `ui-styling` orientou o uso de viewport dinâmica, overflow interno, layout mobile-first e preservação da acessibilidade do Dialog.
- O modal agora usa largura progressiva até `max-w-6xl`, respeita a altura dinâmica da viewport e mantém o cabeçalho visível enquanto o corpo rola.
- Cartões, metadados e ações mudam para uma coluna em larguras menores; textos longos quebram linha sem provocar overflow horizontal.
- Nenhuma regra de negócio, chamada de API, dependência ou estrutura de banco foi alterada.

### File List

- `docs/stories/story-chamados-modal-detalhes-responsivo.md`
- `plan/self-critique-chamados-modal.json`
- `src/components/DetalhesChamado.tsx`

## QA Results

_A preencher pelo agente de QA._
