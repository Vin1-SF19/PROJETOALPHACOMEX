# Alpha CRM

Módulo de CRM do Painel Alpha — pipelines de vendas, cards de oportunidade,
dashboard e administração de pipelines.

## Rotas

| Rota | Descrição |
|------|-----------|
| `/PainelAlpha/AlphaCRM` | Dashboard (lista de pipelines) |
| `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` | Board Kanban do pipeline |
| `/PainelAlpha/AlphaCRM/admin` | Administração de pipelines |
| `/PainelAlpha/AlphaCRM/tarefas` | Central de tarefas |
| `/PainelAlpha/AlphaCRM/empresa/[empresaId]` | Detalhe da empresa |

## Visual Design

### Background espacial

O layout raiz do CRM (`CRMLayoutClient.tsx`) renderiza
`<CrmSpaceBackground>` como primeira camada do container. O background é um
"espaço profundo" com:

- **Partículas animadas** (60 desktop / 25 mobile) — opacidade em loop.
- **3 nébulas temáticas** com cores derivadas dos módulos de referência:
  - Checklist → azul-ciano
  - CS & NPS → verde-âmbar
  - Extratos Bancários → violeta
- **Ícones sutis** (`CheckSquare`, `TrendingUp`, `Banknote`) a 3% de opacidade
  como semântica visual.
- `pointer-events-none` + `aria-hidden` — nunca interfere na interação.
- `prefers-reduced-motion` respeitado.

Ver `docs/components/crm-space-background.md` para detalhes.

### Sistema de bordas animadas

Cards de pipeline (KanbanCard e Dashboard) usam `<CrmPipelineBorder>` —
borda com gradiente radial animado que:

- Rota ciclicamente TOP → LEFT → BOTTOM → RIGHT em repouso.
- No hover/focus: pausa a rotação, intensifica para `#6366f1` (indigo) +
  highlight central.
- Transição 300ms ease-out.
- `prefers-reduced-motion`: borda estática.

Ver `docs/components/crm-pipeline-border.md` para detalhes.

### Grid de pipelines com tamanho proporcional (RM-2026-41E240, 2026-08-17)

Pipelines têm largura proporcional responsiva (não crescem com o conteúdo):

| Breakpoint | Largura |
|------------|---------|
| Base (mobile) | `100%` |
| `md` (≥768px) | `260px` |
| `lg` (≥1024px) | `280px` |
| `xl` (≥1280px) | `300px` |

Gap entre colunas: `gap-3` (12px). Capacidade: ≥ 4 colunas em 1280px, ≥ 6 em 1920px.

Altura: pipelines ocupam 100% da área visível (`h-full` + `flex-1` + `min-h-0`).
Cards mantêm `min-h-[200px]` / `max-h-[600px]` + rolagem interna no
`CrmPipelineBorder` inner content (`overflow-y-auto`). Margem inferior do
contêiner: `pb-[clamp(8px,2vh,24px)]` (responsiva, não fixa em px).

Contenção da linha de destaque: card usa `overflow-hidden`; a accent bar
(`absolute inset-y-0 left-0 w-1`) e a `border-red-500/70` ficam contidas nos
limites do card. Sombra dupla de profundidade com elevação no hover (300ms).

Ver `docs/components/pipeline.md` para detalhes.

### Estilização de Cards (RM-2026-57E057, 2026-08-17)

O shell visual dos cards do pipeline (`KanbanCard`, em
`pipeline/[pipelineId]/PipelineBoardClient.tsx`) usa o componente
`GradientBlobCard`:

- **Localização:** `src/components/ui/gradient-blob-card.tsx`
- **Import:** `import GradientBlobCard from "@/components/ui/gradient-blob-card";`
- **Props:** `children` (`React.ReactNode`), `className` (`string`, opcional).
- **Visual:** gradiente animado (blob) pink/red/yellow, sombra dupla
  neumófica com efeito de flutuação, fundo glassy (`backdrop-blur`) e altura
  compacta (definida pelo conteúdo, sem `min-h` fixo no shell).
- **Dark mode e responsividade:** cores adaptadas via `dark:`, contido por
  `overflow-hidden`; funciona nos breakpoints já existentes do grid de
  pipelines (ver seção acima).

```tsx
import GradientBlobCard from "@/components/ui/gradient-blob-card";

<GradientBlobCard>
  <div>{/* conteúdo do card */}</div>
</GradientBlobCard>
```

Ver `docs/components/gradient-blob-card.md` para detalhes completos.

## Componentes principais

| Componente | Arquivo |
|------------|---------|
| `CrmSpaceBackground` | `CRMBackground.tsx` |
| `CrmPipelineBorder` | `src/components/ui/crm-pipeline-border.tsx` |
| `GradientBlobCard` | `src/components/ui/gradient-blob-card.tsx` |
| `CRMLayoutClient` | `CRMLayoutClient.tsx` |
| `DashboardClient` | `DashboardClient.tsx` |
| `PipelineBoardClient` | `pipeline/[pipelineId]/PipelineBoardClient.tsx` |

## Dependências

- `framer-motion` — animações (partículas, borda animada)
- `lucide-react` — ícones
- `@/lib/utils` (`cn`) — merge de classes
