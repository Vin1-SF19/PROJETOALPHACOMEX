# Changelog

## [crm] 2026-08-17 – RM-2026-57E057

### Changed
- Cards dos pipelines agora utilizam o componente `GradientBlobCard` (`src/components/ui/gradient-blob-card.tsx`) com gradiente animado (blob pink/red/yellow), sombras de flutuação (neumórfica dupla, dark mode) e altura compacta.

### Added
- `GradientBlobCard` em `src/components/ui/gradient-blob-card.tsx`, documentado em `docs/components/gradient-blob-card.md`.
- Keyframes globais `@keyframes blob` / `.animate-blob` em `src/app/globals.css` (evita `<style>` duplicada por card).

### Fixed
- Restaurada a cor de status pós-fechamento (`statusConfig?.cardClassName`) e a accent bar de hover (`group-hover:w-1.5`) do `KanbanCard`, perdidas na integração inicial do `GradientBlobCard`.

## [Alpha CRM] – RM-2026-C4A90D

### Added
- Background espacial com partículas animadas e nébulas temáticas (Checklist, CS & NPS, Extratos).
- Componente `CrmPipelineBorder` com gradiente radial animado no hover.
- Sombra dupla de profundidade nos pipelines com elevação no hover.

### Changed
- Pipelines agora têm largura fixa responsiva (340/380/420px) e altura com min/max + scroll interno.
- Removido dimensionamento por conteúdo interno nos pipelines.

### Dependencies
- `framer-motion` adicionado (se não existia).
