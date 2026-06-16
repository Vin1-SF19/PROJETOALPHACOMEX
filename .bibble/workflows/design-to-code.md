# Workflow: Design to Code

**Trigger:** Feature com design visual complexo ou novo padrão de UI  
**Responsável:** Iris → Nova (→ Forge → Probe)  
**Quando usar:** Landing pages, dashboards, novos componentes UI, redesign  

---

## Descrição

Fluxo otimizado para features que começam com design: Iris cria a especificação visual com 3 opções, usuário escolhe, Nova implementa.

## Fluxo

```
Atlas (tokens) → Iris (3 opções) → Usuário escolhe → Nova (implementa) → Forge → Probe
```

## Fase 0 — Tokens (Atlas) — Se necessário

Se o projeto ainda não tem design tokens definidos:

**Task:** `tasks/atlas-extract-tokens.md`

Atlas extrai ou define:
- Paleta de cores
- Tipografia
- Espaçamentos
- Border radius

Salva em `.bibble/memory/design-tokens.md`

---

## Fase 1 — Especificação Visual (Iris)

Iris lê os tokens e cria 3 opções de design:

```markdown
## Iris — Design Spec: [Nome da Feature]

### Contexto
[Onde será usado, qual é o objetivo visual]

### Tokens disponíveis
[Referência ao design-tokens.md]

---

## Opção 1 — [Nome do estilo, ex: "Minimalista"]
### Layout
[Descrição do layout, grid, composição]

### Componentes
- Header: [descrição]
- Body: [descrição]  
- Actions: [descrição]

### Cores usadas
- Background: --color-background
- Accent: --color-brand

### Animações
- [entrada, hover, transições]

### Estado mobile
[Como adapta para mobile]

---

## Opção 2 — [Nome do estilo, ex: "Glassmorphism"]
[...]

---

## Opção 3 — [Nome do estilo, ex: "Minimalista Dark"]
[...]

---

## Recomendação
Iris recomenda a Opção [N] porque [motivo baseado no contexto do projeto]
```

**Gate:** Usuário escolhe uma opção

---

## Fase 2 — Implementação (Nova)

Nova implementa a opção escolhida:

**Processo:**
1. Ler a spec do Iris para a opção escolhida
2. Ler `.bibble/memory/design-tokens.md`
3. Ler `.bibble/memory/components.md` (verificar componentes existentes)
4. Implementar componente seguindo a spec
5. Testar estados: default, hover, loading, empty, error

**Exemplo de componente gerado:**

```tsx
// src/components/[Feature]/[Feature]Card.tsx
'use client'  // apenas se necessário

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface [Feature]CardProps {
  title: string
  description: string
  variant?: 'default' | 'highlighted'
  className?: string
}

export function [Feature]Card({ title, description, variant = 'default', className }: [Feature]CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border p-4 transition-all',
        variant === 'default' && 'bg-surface border-border',
        variant === 'highlighted' && 'bg-brand/10 border-brand',
        className
      )}
    >
      <h3 className="text-text-primary font-semibold">{title}</h3>
      <p className="text-text-secondary text-sm mt-1">{description}</p>
    </motion.div>
  )
}
```

---

## Fase 3 — Validação Técnica

**Forge:** build check (obrigatório)
**Probe:** verificar que aparece onde deve aparecer

---

## Fase 4 — Atualização do Catálogo (Scribe)

Scribe adiciona ao `components.md`:

```markdown
### [Feature]Card
- **Localização:** `src/components/[Feature]/[Feature]Card.tsx`
- **Uso:** Card para [contexto de uso]
- **Variantes:** default, highlighted
- **Props:** title, description, variant, className
- **Design:** Opção [N] do design spec de [data]
```

## Outputs Esperados

- Spec visual do Iris documentada
- Componente implementado pela Nova
- Build passando (Forge)
- Catálogo atualizado (Scribe)

## Quando NÃO usar este workflow

- Feature sem UI (API pura, migration, etc.)
- Pequena modificação em componente existente (editar direto)
- Bug fix visual (corrigir direto, sem spec)
