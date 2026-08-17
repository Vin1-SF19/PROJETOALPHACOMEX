# GradientBlobCard

Shell visual com gradiente animado (blob), sombra dupla neumófica e fundo
glassy, usado nos cards do pipeline do Alpha CRM (RM-2026-57E057).

## Arquivo

`src/components/ui/gradient-blob-card.tsx`

## Tipo

Client Component (`"use client"`).

## Props

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `children` | `React.ReactNode` | — | Conteúdo interno do card (título, tags, avatares etc). |
| `className` | `string` | — | Classes Tailwind adicionais no wrapper. |

## Exemplo de uso

```tsx
import GradientBlobCard from "@/components/ui/gradient-blob-card";

<GradientBlobCard>
  <div>
    {/* conteúdo do card de pipeline */}
  </div>
</GradientBlobCard>
```

## Comportamento

- **Fundo glassy:** `backdrop-blur-[24px]`, `bg-white/80` (claro) /
  `dark:bg-black/50` (escuro), `outline-2 outline-white`/`dark:outline-gray-700`.
- **Blob animado:** gradiente `from-pink-500 via-red-500 to-yellow-500`,
  `blur-[12px]`, posicionado em `z-[15]` (entre o glassy `z-10` e o conteúdo
  `z-20`) para ficar visível em ambos os modos.
- **Sombra dupla (neumófica):** `shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff]`
  claro / `dark:shadow-[20px_20px_60px_#111,-20px_-20px_60px_#222]` escuro.
- **Altura:** não fixa, definida pelo conteúdo (`p-3`, `w-full`), permitindo
  layout compacto nos cards do pipeline.
- **`overflow-hidden`** no wrapper contém o blob e a sombra dentro dos limites
  do card.
- **`prefers-reduced-motion`:** os keyframes globais (`globals.css`) desligam
  a animação do blob.

## Performance

Os `@keyframes blob` e a classe `.animate-blob` vivem em `src/app/globals.css`
(não em `<style>` inline por instância), evitando duplicação de tags `<style>`
quando há 20+ cards renderizados simultaneamente no board.

## Integração

Usado no `KanbanCard` de
`src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`,
envolvendo o conteúdo do card (título, serviço/tags, avatares, contadores).
Os handlers de dnd-kit (`useSortable`, `attributes`, `listeners`) e o `onClick`
de abertura permanecem no wrapper externo, fora do `GradientBlobCard`.

## Dependências

- `@/lib/utils` (`cn`)
- Nenhuma dependência nova instalada.
