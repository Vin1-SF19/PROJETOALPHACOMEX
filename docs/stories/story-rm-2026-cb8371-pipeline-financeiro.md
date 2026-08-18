# Story RM-2026-CB8371 — Pipeline financeiro
## Status
Ready for Review
## Acceptance Criteria
- [x] Seis etapas sequenciais sem recriar pipeline ou cards.
- [x] Schema versionado com categorias obrigatório, condicional e automático/calculado.
- [x] Avanço bloqueado com lista nominal de pendências e sem salto.
- [x] Retenções calculadas no servidor com memória auditável.
- [x] Anexos usam o fluxo autenticado já existente no card.
- [x] Acesso pelo quadro `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]`.
## File List
- `src/lib/bpm/pipeline-financeiro.ts`
- `src/actions/bpm/PipelineFinanceiro.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ConfigurarEtapasFinanceiroButton.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `scripts/bpm-seed-pipelines.mjs`
- `tests/bpm/pipeline-financeiro.test.ts`
