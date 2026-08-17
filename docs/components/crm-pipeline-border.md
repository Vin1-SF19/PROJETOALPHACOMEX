# CrmPipelineBorder

Borda animada com gradiente radial para cards de pipeline do Alpha CRM.
Inspirado no padrão Aceternity `HoverBorderGradient`, com cores, timing e
intensidade próprios do tema do CRM.

## Arquivo

`src/components/ui/crm-pipeline-border.tsx`

## Tipo

Client Component (`'use client'`).

## Props

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `children` | `React.ReactNode` | — | Conteúdo interno do card. |
| `className` | `string` | — | Classes Tailwind adicionais no wrapper. |
| `duration` | `number` | `1.2` | Duração do ciclo de rotação em segundos. |
| `highlightColor` | `string` | `'#6366f1'` | Cor do highlight no hover (indigo do CRM). |
| `idleColor` | `string` | `'rgba(255,255,255,0.08)'` | Cor da borda em repouso. |
| `borderRadius` | `string` | `'12px'` | Raio da borda. |

## Exemplo de uso

```tsx
import { CrmPipelineBorder } from '@/components/ui/crm-pipeline-border';

<CrmPipelineBorder highlightColor="#6366f1" duration={1.2}>
  <div className="p-5">
    {/* conteúdo do card de pipeline */}
  </div>
</CrmPipelineBorder>
```

## Comportamento

- **Repouso:** gradiente radial `idleColor` a 15% de opacidade, rotação cíclica
  TOP → LEFT → BOTTOM → RIGHT via `setInterval` (pausa no hover/focus).
- **Hover/focus:** gradiente muda para `highlightColor` a 100% de opacidade +
  highlight central `blur(3px)` a 60% de opacidade. Transição 300ms ease-out.
- **`prefers-reduced-motion`:** borda estática `highlightColor` a 30% de
  opacidade, sem rotação nem animação.
- **Acessibilidade:** `role="none"` no wrapper, `aria-hidden="true"` nas camadas
  decorativas, `focus-visible` via `onFocusCapture`/`onBlurCapture`.

## Comparação com a referência (Aceternity)

| Aspecto | Aceternity `HoverBorderGradient` | `CrmPipelineBorder` |
|---------|----------------------------------|---------------------|
| Cor do highlight | `#3275F8` fixo | `#6366f1` (indigo do CRM) — configurável |
| Timing | padrão do Aceternity | `1.2s` por ciclo — configurável |
| Raio do gradiente | fixo | `120px` — configurável via `borderRadius` |
| `prefers-reduced-motion` | não tratado | tratado (borda estática) |
| `focus-visible` | não tratado | tratado (`onFocusCapture`) |
| Inner background | transparente | `bg-[#0f1629]` (contraste com o background espacial) |

## Notas de performance

- `setInterval` pausado no hover/focus e em `reducedMotion` — não consome CPU
  quando o card está ativo.
- `blur(2px)` no gradiente + `blur(3px)` no highlight — valores baixos, custo
  de rasterização mínimo.
- Funciona com `overflow-hidden` no card (gradiente absoluto dentro do
  container, não fora).

## Dependências

- `framer-motion` (`motion`, `useReducedMotion`)
- `@/lib/utils` (`cn`)
