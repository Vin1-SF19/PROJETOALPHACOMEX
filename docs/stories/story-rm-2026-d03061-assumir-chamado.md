# Story RM-2026-D03061 — Assumir Chamado

## Objetivo

Substituir as ações administrativas do detalhe de chamado por um fluxo em duas etapas: assumir um chamado aberto e, depois da assunção, finalizá-lo com protocolo.

## Critérios de aceite

- [x] Chamado aberto e sem técnico exibe somente **Assumir Chamado**.
- [x] A assunção vincula o usuário autenticado e altera o status para `EM_ATENDIMENTO`.
- [x] A assunção concorrente não sobrescreve o primeiro técnico.
- [x] Após sucesso, o detalhe troca imediatamente para **Finalizar com Protocolo**.
- [x] Erros mantêm a ação disponível e exibem feedback ao usuário.
- [x] **Em Atendimento** e **Finalizar Rápido** não são renderizados.
- [x] O fluxo existente de finalização com protocolo é preservado.
- [ ] Gates de qualidade executados.

## Entregabilidade

Consumidor: administradores do módulo Chamados.

Caminho: `/PainelAlpha/Chamados` → botão **Detalhes** de um chamado → **Assumir Chamado** → **Finalizar com Protocolo**.

## File List

- `prisma/schema.prisma`
- `prisma/migrations/20260831180000_add_chamados_tecnico_id/migration.sql`
- `src/actions/chamados.ts`
- `src/components/DetalhesChamado.tsx`
- `tests/chamados/assumir.test.ts`
- `docs/stories/story-rm-2026-d03061-assumir-chamado.md`
