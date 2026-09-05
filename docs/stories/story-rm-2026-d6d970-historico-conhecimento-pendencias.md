# RM-2026-D6D970 — 10. Histórico, Conhecimento e Pendências

## Status

Ready for Review — implementado pelo operador humano (via Claude Code) em conjunto com trabalho paralelo do Codex sobre a mesma timeline unificada (ver nota de colaboração abaixo).

## Análise do que já existia (obrigatória pela descrição original)

Antes de implementar, foi confirmado que boa parte do pedido **já existia**:

- **Timeline unificada:** `src/lib/bpm/timeline.ts` (`montarFeedTimelineCard`) já fundia `BpmCardHistorico` (com `valorAnteriorJson`/`valorNovoJson`/`automacaoOrigem` — quem/quando/ação/valor anterior/valor novo/origem, exatamente a auditoria pedida) e anotações num feed cronológico único, renderizado na aba "Histórico" de `PainelHistorico.tsx`. `LABELS_EVENTO_TIMELINE` já cobria tarefas, checklists, automações, distribuição, oportunidades, cadências, reuniões — porque cada módulo já escreve em `BpmCardHistorico` via `registrarHistoricoCard`.
- **Nada equivalente** existia para Base de Conhecimento aplicada ao processo, nem para uma Central de Pendências consolidada.

## Nota de colaboração — timeline (2026-09-04)

Durante a implementação, o Codex construiu **em paralelo** uma segunda via para o mesmo requisito de timeline unificada: `PainelTimelineCard.tsx` (nova aba "Timeline" em `PainelHistorico.tsx`), consumindo `ListarTimelineCardBpm`/`extractCardTimelineEvents` — que o operador havia criado e depois removido por julgar redundante com `montarFeedTimelineCard`, sem saber que o Codex já dependia desses arquivos. Os arquivos foram restaurados. Resultado final, por decisão do usuário: a aba "Histórico" (já existente, histórico+anotações) permanece intocada; a nova aba "Timeline" (mais completa: também tarefas, checklists, automações e SLA quando disponível) é a referência para timeline unificada completa deste objetivo.

## Entregáveis novos (sem duplicar dado)

### Base de Conhecimento aplicada ao processo

`BpmPipelineConhecimentoLink` (migration aditiva `20260904174200_bpm_pipeline_conhecimento_link`) — não duplica o repositório DocsAlpha (baseado em arquivos, sem tabela própria endereçável por id); em vez disso, referencia por link/URL os materiais relevantes por pipeline. CRUD em `src/actions/bpm/Conhecimento.ts` (gate `exigirAcessoConfigPipeline`), UI admin em `/PainelAlpha/AlphaCRM/admin/conhecimento`, exibição em `PainelConhecimentoRelacionado.tsx` no painel do card (seção "Documentos relacionados", só aparece quando há links cadastrados).

### Central de Pendências

`src/lib/bpm/pendencias/motor.ts` (`listarPendenciasBpm`) — consolida, sem nova tabela, o que exige ação do usuário: tarefas pendentes (`BpmTarefa`), próximo contato vencido (`BpmCard.proximoContatoEm`), checklists incompletos (`BpmCardChecklist`), campos obrigatórios faltantes na etapa atual (`BpmCampo` × `BpmCardCampoValor`), e alertas de SLA (`BpmSlaInstancia`, fail-open — RM-2026-095B40 ainda não aplicado em produção nesta data). Escopo: cards do próprio usuário (responsável ou membro); admin/diretoria veem tudo. UI em `/PainelAlpha/AlphaCRM/pendencias`, com filtro por tipo e link direto ao pipeline do card. Item de menu adicionado em `CRMLayoutClient.tsx`.

## Gates

- `npx prisma validate`: OK.
- `npx tsc --noEmit`: sem diagnósticos nos arquivos da entrega (baseline global pré-existente inalterado).
- `npx eslint` nos arquivos da entrega: sem diagnósticos.
- `npx vitest run tests/bpm/`: 626 aprovados / 21 falhas — mesma baseline pré-existente já documentada (17 originais + 4 de funções não tocadas por esta entrega, já rastreadas a trabalho paralelo em andamento). Testes novos: `tests/bpm/pendencias-motor.test.ts` (11/11), `tests/bpm/conhecimento-actions.test.ts` (6/6).
- `npm run build` (`NODE_OPTIONS=--max-old-space-size=8192`): exit 0.

## File List

- `prisma/schema.prisma`
- `prisma/migrations/20260904174200_bpm_pipeline_conhecimento_link/migration.sql`
- `src/lib/bpm/pendencias/motor.ts`
- `src/actions/bpm/Pendencias.ts`
- `src/actions/bpm/Conhecimento.ts`
- `src/actions/bpm/Timeline.ts` (restaurado — dependência do `PainelTimelineCard.tsx` do Codex)
- `src/lib/timeline/extractors/card.ts` (restaurado, idem)
- `src/components/bpm/pendencias/PendenciasWorkspace.tsx`
- `src/components/bpm/conhecimento/ConhecimentoWorkspace.tsx`
- `src/components/bpm/conhecimento/PainelConhecimentoRelacionado.tsx`
- `src/app/PainelAlpha/AlphaCRM/pendencias/page.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/conhecimento/page.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx`
- `tests/bpm/pendencias-motor.test.ts`
- `tests/bpm/conhecimento-actions.test.ts`
- `.bibble/memory/architecture.md`

## Fora de escopo (documentado)

- Deep-link direto ao card específico a partir da Central de Pendências (abre o board do pipeline; localizar o card ainda é manual).
- Ação "criar card em outro pipeline" a partir de uma pendência.
