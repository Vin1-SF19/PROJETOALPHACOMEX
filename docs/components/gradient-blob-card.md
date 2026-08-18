# GradientBlobCard

Shell visual dos cards de oportunidade (`KanbanCard`) do pipeline Kanban do
Alpha CRM. O nome foi mantido por compatibilidade, embora o blob decorativo
tenha sido removido em RM-2026-5284A1.

## Arquivo

`src/components/ui/gradient-blob-card.tsx`

## Tipo

Client Component (`"use client"`).

## Props

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `children` | `React.ReactNode` | — | Conteúdo interno do card. |
| `className` | `string` | — | Classes Tailwind adicionais no wrapper. |
| `surfaceClassName` | `string` | — | Tint opcional aplicado apenas à superfície interna. |
| `accent` | `string` | `"37, 99, 235"` | Cor RGB crua da faixa semântica lateral. |

## Exemplo

```tsx
import { GradientBlobCard } from "@/components/ui/gradient-blob-card";

<GradientBlobCard
  accent={accent}
  className="rounded-2xl"
  surfaceClassName={statusConfig?.cardClassName}
>
  <div>{/* conteúdo do card */}</div>
</GradientBlobCard>
```

## Comportamento

- Borda de 1 px em `blue-600` (`#2563eb`, azul Alpha), sem glow.
- Fundo `slate-800/95`, mais claro que o fundo do pipeline e com contraste AA
  para o texto branco existente.
- `shadow-none`; o feedback funcional de arraste permanece no wrapper externo.
- Hover `scale(1.02)` com transição de 150 ms. Reduced motion conserva escala 1.
- Faixa lateral absoluta e interna de 3 px, sem margem ou gap. A cor permanece
  dinâmica pela prop `accent`.
- `surfaceClassName` preserva o tint de status pós-fechamento sem substituir a
  borda azul Alpha.
- `overflow-hidden` mantém a faixa dentro do raio do card.

## Acessibilidade

As camadas decorativas usam `aria-hidden="true"`, e a microinteração respeita
`prefers-reduced-motion`.

## Integração

Usado dentro do `KanbanCard` em
`src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`.
Os handlers do dnd-kit e o clique de abertura permanecem no wrapper externo.

## Dependências

- `@/lib/utils` (`cn`)
