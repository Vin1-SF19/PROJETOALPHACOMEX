# CrmSpaceBackground

Background "espaço profundo" do módulo Alpha CRM. Camada decorativa de partículas
animadas e nébulas temáticas que evocam os três módulos de referência (Checklist,
CS & NPS e Extratos Bancários).

## Arquivo

`src/app/PainelAlpha/AlphaCRM/CRMBackground.tsx`

> **Nota de localização:** o componente vive no folder do módulo (não em
> `src/components/ui/`) — mesmo padrão de `ChecklistBackground.tsx` e
> `CsNpsBackground.tsx`. É um componente module-specific, não genérico.

## Tipo

Client Component (`'use client'`).

## Props

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `className` | `string` | — | Classes Tailwind adicionais (merge via `cn`). |
| `intensity` | `'low' \| 'medium' \| 'high'` | `'medium'` | Controla opacidade mínima/máxima das partículas e a velocidade da animação. |

## Exemplo de uso

```tsx
import { CrmSpaceBackground } from '@/app/PainelAlpha/AlphaCRM/CRMBackground';

// Em CRMLayoutClient.tsx — primeira camada do container raiz
<div className="relative min-h-screen bg-[#020617] flex">
  <CrmSpaceBackground intensity="medium" />
  {/* sidebar + content com relative z-10 */}
</div>
```

## Comportamento

- **Partículas:** 60 em desktop, 25 em mobile (`<768px`). Cada partícula é um
  `motion.div` com animação de opacidade em loop (`easeInOut`, `repeat: Infinity`).
- **Nébulas:** 3 blobs com `blur-[120px]` e cores derivadas dos módulos:
  - Checklist → azul-ciano (`rgba(59,130,246,0.08)`)
  - CS & NPS → verde-âmbar (`rgba(16,185,129,0.06)`)
  - Extratos → violeta (`rgba(139,92,246,0.07)`)
- **Ícones sutis:** `CheckSquare`, `TrendingUp`, `Banknote` a `white/[0.03]`
  como semântica visual dos módulos.
- **Acessibilidade:** `aria-hidden="true"` + `pointer-events-none` — nunca
  intercepta interação nem é anunciado por leitores de tela.
- **`prefers-reduced-motion`:** respeitado via `useReducedMotion()` — partículas
  ficam estáticas (opacidade fixa) e nébulas não animam.

## Notas de performance

- `will-change: opacity` nas partículas (só a propriedade animada).
- `blur` limitado a `120px` (evita custo de rasterização excessivo).
- Em mobile, nébulas ficam estáticas (sem `animate`) para reduzir trabalho de
  compositor.
- O componente é `absolute inset-0 z-0` — não gera reflow nem afeta o layout.

## Dependências

- `framer-motion` (`motion`, `useReducedMotion`)
- `lucide-react` (`CheckSquare`, `TrendingUp`, `Banknote`)
- `@/lib/utils` (`cn`)
