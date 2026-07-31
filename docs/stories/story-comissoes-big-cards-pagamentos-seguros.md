# Story: Comissões — Big Cards completos e pagamentos seguros

## Status

Ready for Review

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["vitest", "eslint", "typescript", "next-build", "coderabbit"]

## Story

**Como** responsável pela gestão financeira de comissões e prêmios,  
**quero** visualizar cada contratação e êxito em Big Cards completos, com lançamentos individuais por colaborador e pagamentos seguros,  
**para que** eu consiga conferir, programar, pagar e exportar os valores sem omissões, duplicidades ou inconsistências.

## Contexto e origem

Story criada a partir do diagnóstico solicitado e aprovado pelo usuário em 2026-07-30, usando como referência o desenho `WhatsApp Image 2026-07-30 at 11.29.01.jpeg` e a implementação existente do módulo.

O escopo cobre todas as lacunas confirmadas no diagnóstico: período global, filtros reais, Big Cards horizontais, dados completos do evento, participantes automáticos, prêmio de primeira tentativa no êxito, mini cards individuais, pagamentos individual e consolidado, exportação por data financeira, atomicidade, recálculo idempotente, comprovantes privados, busca correta e redução de consultas N+1.

## Acceptance Criteria

1. A barra do relatório permite período por mês, semana ou intervalo livre e aplica o mesmo período à listagem e aos indicadores.
2. A busca localiza CNPJ, razão social, nome fantasia, serviço, colaborador e cargo.
3. Os filtros de evento, componente, vínculo, setor, cargo, colaborador, forma de pagamento e status são funcionais.
4. Os eventos aparecem em uma lista vertical de Big Cards horizontais e responsivos, com dados à esquerda, setores no centro e ação consolidada à direita.
5. Contratação e êxito da mesma empresa permanecem eventos financeiros separados, nunca fases mutáveis de um único registro.
6. O card mostra CNPJ, razão social, nome fantasia, serviço, honorários bruto/líquido, forma de pagamento, data da contratação e status correto.
7. O card de êxito também mostra data do êxito, tentativas, primeira tentativa e status do processo operacional.
8. Cada mini card representa um único colaborador e mostra cargo, nome, comissão, prêmio, DSR, ajustes, total, status e datas previstas/programadas.
9. Múltiplos colaboradores no mesmo cargo geram mini cards separados.
10. A contratação gera automaticamente todos os participantes resolvíveis; participantes sem fonte confiável ficam explicitamente sinalizados para atribuição manual.
11. O êxito gera automaticamente analista responsável, auxiliar, auditor e diretor quando vinculados ao processo.
12. O prêmio/adicional de primeira tentativa integra o mesmo Big Card de êxito, sem criar um terceiro Big Card financeiro para a empresa.
13. O recálculo de lançamento pendente substitui componentes anteriores de forma atômica e não duplica entries nem componentes.
14. O pagamento individual usa o saldo pendente, impede sobrepagamento e oferece pagamento integral ou parcial, data, meio, referência, observação e comprovante.
15. Programação de pagamento solicita data e atualiza o status sem usar automaticamente a data atual.
16. O pagamento consolidado sempre mostra colaborador, cargo, componentes, valor individual, saldo, excluídos com motivo, total, data, meio, observação e comprovante antes da confirmação.
17. Pagamentos, alocações, status e auditoria são gravados em transação; falhas não deixam registros parciais.
18. Comprovantes de pagamento usam armazenamento privado, validação de tipo/tamanho e acesso autenticado/autorizado.
19. O espelho usa a data do evento financeiro, respeita mês/semana/intervalo livre, separa comissão/prêmio/DSR e permanece disponível em PDF/XLSX.
20. A leitura do dashboard evita consultas N+1 por evento/colaborador e mantém paginação.
21. Uma restrição única garante no banco um lançamento por `eventId + collaboratorId`, após verificação de duplicatas e protocolo Vault.
22. Testes automatizados cobrem sincronização, primeira tentativa, auxiliar/auditor/diretor, recálculo, sobrepagamento, pagamento parcial, transações, lote, filtros, indicadores e exportação.
23. Lint, typecheck, testes, build e revisão CodeRabbit são executados antes da conclusão.

## Tasks / Subtasks

- [x] Task 1 — Período, filtros, busca e indicadores (AC: 1–3)
  - [x] Unificar o contrato de filtros do dashboard.
  - [x] Aplicar filtros à listagem e aos indicadores.
  - [x] Implementar busca por colaborador e cargo.
- [x] Task 2 — Big Cards e dados completos (AC: 4–9)
  - [x] Alterar a listagem para uma coluna.
  - [x] Ajustar layout responsivo e ação consolidada lateral.
  - [x] Exibir dados de contratação, êxito e status do processo.
- [x] Task 3 — Participantes e regras de êxito (AC: 10–12)
  - [x] Resolver participantes do contrato/processo.
  - [x] Incorporar adicionais de primeira tentativa ao evento de êxito.
  - [x] Evitar lançamento comercial divergente no êxito sem regra aplicável.
  - [x] Remover falso positivo de serviço sem tarifário quando honorários brutos vierem do contrato.
- [x] Task 4 — Idempotência e integridade dos lançamentos (AC: 13, 21)
  - [x] Substituir componentes em transação no recálculo.
  - [x] Impedir entries divergentes duplicadas.
  - [x] Adicionar índice único após Vault, backup e validação de duplicatas.
- [x] Task 5 — Pagamentos seguros (AC: 14–18)
  - [x] Calcular e validar saldo individual.
  - [x] Implementar integral/parcial e programação com data.
  - [x] Enriquecer prévia e confirmação em lote.
  - [x] Tornar gravações transacionais.
  - [x] Privatizar e validar comprovantes.
- [x] Task 6 — Espelho e performance (AC: 19–20)
  - [x] Filtrar espelho por data do evento.
  - [x] Consolidar consulta do dashboard e eliminar N+1.
- [x] Task 7 — Qualidade (AC: 22–23)
  - [x] Adicionar testes unitários e de integração.
  - [x] Executar lint, typecheck, testes e build.
  - [x] Tentar revisão CodeRabbit e registrar indisponibilidade do WSL.

## Dev Notes

- Banco de runtime: Turso remoto via `TURSO_DATABASE_URL`; o Prisma CLI local não aplica alterações no banco de produção. [Source: `.bibble/memory/known-errors.md#banco-prisma-local-vs-turso`]
- Valores monetários permanecem em centavos (`Int`). [Source: `.bibble/memory/architecture.md#Módulo-Gestão-de-Comissões-e-Prêmios`]
- Mudanças estruturais exigem Vault, backup completo verificado e confirmação específica. [Source: `AGENTS.md#Database-Safety-and-Backup-Policy`]
- A implementação existente usa `CommissionEvent`, `CommissionEntry`, `EntryComponent`, `Payment` e `PaymentAllocation`; a story evolui esses contratos sem criar um módulo paralelo. [Source: `prisma/schema.prisma`]
- Preservar as alterações não relacionadas que já existem no worktree.

### Testing

- Testes do módulo: `tests/commissions/`, usando Vitest.
- Cobrir os cenários financeiros negativos e de rollback, não apenas os caminhos de sucesso.
- Validar responsividade e fluxo de confirmação na interface.
- Gates obrigatórios: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## 🤖 CodeRabbit Integration

**Primary Type:** Database  
**Secondary Types:** API, Frontend, Security, Integration  
**Complexity:** High

**Primary Agents:**
- @dev
- @db-sage

**Supporting Agents:**
- @ux-expert
- @qa
- @github-devops

**Quality Gate Tasks:**
- [ ] Pre-Commit (@dev): revisar alterações não commitadas.
- [ ] Pre-PR (@github-devops): revisar integração e compatibilidade.
- [ ] Pre-Deployment (@github-devops): validar migration, backup e rollback.

**Expected Self-Healing:**
- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutes
- Severity Filter: CRITICAL
- CRITICAL: auto-fix
- HIGH: document-only

**Focus Areas:**
- Atomicidade, idempotência, concorrência e limites de pagamento.
- Segurança e autorização de comprovantes.
- Migração reversível e compatibilidade com Turso/SQLite.
- Acessibilidade, responsividade e consistência dos filtros.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-07-30 | 1.0 | Story criada e aprovada a partir do diagnóstico confirmado pelo usuário. | River |
| 2026-07-31 | 1.1 | Removido falso positivo de tarifário quando o contrato já fornece honorários brutos; divergências legadas são reconciliadas. | Codex |

## Dev Agent Record

### Agent Model Used

Codex / GPT-5

### Debug Log References

- Backup Vault: `database-backups/pre-change/painelalpha_turso_pre_change_comissoes-hardening_2026-07-30T19-01-51Z.sql`.
- CodeRabbit: `docs/qa/coderabbit-reports/story-comissoes-big-cards-pagamentos-seguros.md`.
- Gate global de typecheck: três erros preexistentes fora de Comissões.
- Gate global de lint: configuração atual inclui `.agents`, `.aiox-core` e `.claude/worktrees`; lint direcionado da story foi aprovado.
- Correção de tarifário: testes direcionados aprovados (20/20), ESLint direcionado aprovado e build Next.js de produção aprovado.
- Suíte global: 570/571 testes aprovados; único teste pendente é timeout preexistente da Agenda/Google Calendar, aprovado isoladamente com margem de 15 segundos.

### Completion Notes List

- Índice único aplicado e verificado no Turso de produção após backup completo validado e autorização explícita.
- Dashboard com período mês/semana/intervalo, filtros funcionais, indicadores coerentes e busca por colaborador/cargo.
- Big Cards horizontais, mini cards individuais e dados completos de contratação/êxito.
- Participantes resolvidos a partir de FKs confiáveis; ambiguidades geram divergência explícita.
- Prêmio de êxito e adicional de primeira tentativa consolidados no mesmo evento e lançamento.
- Pagamentos individuais e em lote protegidos por saldo, confirmação detalhada, transação e auditoria.
- Comprovantes privados com download autenticado.
- Leitura em lote removeu o N+1 por evento/colaborador.
- 60 arquivos de teste e 491 testes aprovados; build de produção aprovado.
- Formas de pagamento dos cards e filtros usam os rótulos oficiais de Metas/CS, incluindo equivalência para códigos legados de Comissões.
- Honorários brutos recebidos do contrato são a fonte do tarifário no motor; `TariffVersion` permanece apenas como referência administrativa e não gera mais divergência duplicada.
- Alertas legados `SERVICO_SEM_TARIFARIO` são ocultados imediatamente e marcados como resolvidos na próxima sincronização do evento.

### File List

- `docs/stories/story-comissoes-big-cards-pagamentos-seguros.md`
- `docs/qa/coderabbit-reports/story-comissoes-big-cards-pagamentos-seguros.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260730161000_commission_entry_event_collaborator_unique/migration.sql`
- `src/actions/CommissionDashboard.ts`
- `src/actions/CommissionDivergences.ts`
- `src/actions/CommissionEntries.ts`
- `src/actions/CommissionEvents.ts`
- `src/actions/CommissionPayments.ts`
- `src/actions/CommissionTariffs.ts`
- `src/app/api/comissoes/comprovantes/[paymentId]/route.ts`
- `src/components/Comissoes/ComissoesDashboard.tsx`
- `src/components/Comissoes/EventoCard/EventoComissaoCard.tsx`
- `src/components/Comissoes/EventoCard/ModalPagarTodos.tsx`
- `src/components/Comissoes/Filtros/FiltrosComissoes.tsx`
- `src/components/Comissoes/lib/formatters.ts`
- `src/components/Comissoes/MiniCard/LancamentoColaboradorCard.tsx`
- `src/components/Comissoes/MiniCard/ModalProgramarPagamento.tsx`
- `src/components/Comissoes/MiniCard/ModalRegistrarPagamento.tsx`
- `src/components/Comissoes/ModalDetalhes/ModalDetalhesLancamento.tsx`
- `src/lib/commissions/entry-generator.ts`
- `src/lib/commissions/divergence-detector.ts`
- `src/lib/commissions/export/preview-builder.ts`
- `src/lib/commissions/participant-resolver.ts`
- `src/lib/commissions/seed-rules.ts`
- `src/lib/commissions/sync-engine.ts`
- `tests/commissions/adapters/sync-engine.test.ts`
- `tests/commissions/commission-payments.test.ts`
- `tests/commissions/divergence-detector.test.ts`
- `tests/commissions/entry-generator.test.ts`
- `tests/commissions/export.test.ts`
- `tests/commissions/gerar-lancamentos-automaticos.test.ts`
- `tests/commissions/formatters.test.ts`
- `tests/commissions/setor-por-role.test.ts`

## QA Results

- Testes: PASS — 60 arquivos, 491 testes.
- Build: PASS.
- ESLint da story: PASS.
- TypeScript da story: PASS; gate global com três erros preexistentes fora do escopo.
- CodeRabbit: indisponível porque WSL não está instalado; relatório registrado.
- Inspeção visual automatizada: indisponível porque não havia navegador conectado; servidor local validado com HTTP 200.
