# Story: Telefones vinculados ao card no Alpha CRM

## Status

Review — implementação concluída; gates globais com pendências preexistentes documentadas

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, acessibilidade

## Story

**Como** usuário do pipeline do Alpha CRM,  
**quero** identificar e abrir o atalho de telefone no detalhe de um card,  
**para** consultar rapidamente o nome e o telefone das pessoas vinculadas à empresa daquele card.

## Contexto e regra de vínculo

O card BPM possui uma empresa obrigatória (`BpmCard.empresaId`). Para esta story, “telefones vinculados ao card” significa os telefones das pessoas associadas a essa empresa por uma das relações já existentes:

- vínculo principal em `socios.clienteId`; ou
- vínculo adicional N:N em `PessoaEmpresaVinculo`.

Não haverá alteração de schema, migration ou mutação de dados. [Source: `.bibble/memory/codebase-map.md#Database-Schema`] [Source: `.bibble/memory/integration-points.md#Integrações-via-Banco-de-Dados`]

## Acceptance Criteria

1. O ícone de telefone no canto superior do detalhe do card apresenta pulsação contínua e discreta, respeitando a preferência de movimento reduzido do sistema.
2. O botão deixa de estar desabilitado, é acessível por teclado e informa seu propósito por nome acessível.
3. Ao clicar no botão, um modal é aberto sobre o detalhe do card sem fechar o bottom sheet atual.
4. O modal lista somente pessoas vinculadas à empresa do card que possuam telefone não vazio, exibindo nome e telefone.
5. Vínculos diretos e vínculos N:N são considerados sem duplicar a mesma pessoa.
6. O modal apresenta estados de carregamento, lista vazia e erro com opção de tentar novamente.
7. A consulta exige sessão autenticada e permissão de visualização do card antes de retornar os telefones.
8. Nenhuma migration, alteração de schema ou mutação de dados é introduzida.
9. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados; falhas preexistentes ou ambientais são separadas das regressões desta story.
10. A coluna direita de etapas usa no desktop somente a largura necessária para seu maior rótulo, mantendo cada etapa em uma única linha e preservando o mesmo gap e padding horizontal existentes à esquerda e à direita do grid.

## Blueprint de Integração

### Criar

- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/TelefonesCardButton.tsx` — botão animado e modal de telefones.
- [x] `tests/bpm/card-telefones.test.ts` — cobertura da autorização e da consulta de vínculos.

### Editar

- [x] `src/actions/bpm/Cards.ts` — action de leitura dos telefones associados à empresa do card.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — substituir o placeholder desabilitado pelo componente funcional e compactar o grid.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` — manter os rótulos de etapa em uma linha.

### Consultar

- `src/lib/bpm/ownership.ts` — fonte única da autorização de leitura do card. [Source: `.bibble/memory/integration-points.md#Alpha-BPM`]
- `src/components/ui/dialog.tsx` — primitivo de modal já adotado no projeto. [Source: `.bibble/memory/components.md#Componentes-UI`]

## Tasks / Subtasks

- [x] Implementar consulta autenticada e somente leitura dos contatos (AC: 4, 5, 7, 8)
- [x] Implementar botão pulsante com suporte a reduced motion (AC: 1, 2)
- [x] Implementar modal e estados de carregamento, vazio e erro (AC: 3, 4, 6)
- [x] Integrar o componente ao cabeçalho do card (AC: 2, 3)
- [x] Compactar a coluna direita de etapas sem alterar o espaçamento simétrico do grid (AC: 10)
- [x] Adicionar testes direcionados da action (AC: 4, 5, 7)
- [x] Executar os gates disponíveis e atualizar checklist/File List, documentando bloqueios externos (AC: 9)

## Testing

- Vitest direcionado em `tests/bpm/card-telefones.test.ts` para sessão, ownership, filtro das duas relações e descarte de telefone vazio.
- Verificação estática de TypeScript e ESLint nos arquivos alterados.
- Gates globais definidos no `AGENTS.md`: lint, typecheck, testes e build.
- Verificação manual esperada: abrir um card com contatos, confirmar pulsação, abrir/fechar o modal por mouse e teclado e validar os estados vazio/erro.

## CodeRabbit Integration

- Tipo primário: Frontend; secundário: API; complexidade baixa.
- Agentes previstos: `@dev`, `@ux-expert`, `@qa`; `@github-devops` somente para PR.
- Pre-Commit: revisão uncommitted; Pre-PR: revisão contra `main` quando houver PR.
- Foco: acessibilidade do botão/modal, reduced motion, autorização da action e ausência de exposição de contatos entre cards.
- Self-healing Dev: light, até 2 iterações/15 min para CRITICAL; HIGH documentado.

## Story Draft Validation

| Category | Status | Issues |
|---|---|---|
| Goal & Context Clarity | PASS | Nenhum |
| Technical Implementation Guidance | PASS | Nenhum |
| Reference Effectiveness | PASS | Nenhum |
| Self-Containment Assessment | PASS | Nenhum |
| Testing Guidance | PASS | Nenhum |
| CodeRabbit Integration | PASS | Nenhum |

**Final Assessment:** READY — escopo determinístico, sem dependência externa ou alteração de banco.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-07 | 1.0 | Story ad hoc criada a partir do pedido do usuário e do reconhecimento do módulo BPM. | River |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx eslint` direcionado aos arquivos alterados — PASS.
- `npx vitest run tests/bpm/card-telefones.test.ts --coverage.enabled=false` — 3/3 PASS.
- `npm test` — 951/952 PASS; timeout preexistente em `tests/google-calendar/cli.test.ts`.
- `npx tsc --noEmit` — sem erro nos arquivos da story; bloqueios preexistentes em Exclusão Fiscal, Radar e Google Calendar.
- `npm run lint` global — excedeu 184 segundos; o lint direcionado passou.
- `npm run build` — execução interrompida pelo usuário antes de produzir resultado.

### Completion Notes List

- O telefone do cabeçalho pulsa, respeita reduced motion e abre o modal sem fechar o detalhe do card.
- A consulta retorna pessoas com telefone vinculadas direta ou adicionalmente à empresa do card, protegida pelo ownership do BPM.
- A coluna direita usa a largura do maior rótulo e mantém todos os nomes de etapas em uma única linha.
- Nenhum schema, migration ou dado persistido foi alterado.

### File List

- `docs/stories/story-alpha-crm-telefones-do-card.md`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/TelefonesCardButton.tsx`
- `tests/bpm/card-telefones.test.ts`

## QA Results

- **CONCERNS:** implementação e testes direcionados aprovados; typecheck/test/lint globais possuem bloqueios preexistentes e o build foi interrompido antes da conclusão.
