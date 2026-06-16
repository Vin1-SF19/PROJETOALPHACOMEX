# STYLING RULES — PADRÕES DE ESTILIZAÇÃO

Lido por: Nova (front), Lens (reviewer)

---

## SISTEMA DE TEMAS — OBRIGATÓRIO

O projeto pode ter um sistema de temas customizado. **TODO componente visual deve respeitar o tema ativo.**

### Antes de criar qualquer componente visual, agentes devem:
1. Localizar o sistema de temas no projeto (Scout confirma o caminho exato)
2. Examinar como temas são aplicados (CSS variables, classes condicionais, Context API, `data-theme`)
3. Examinar um componente que JÁ usa o tema como referência
4. Aplicar o tema seguindo a convenção existente

### NUNCA fazer:
- ❌ Hardcode de cores que ignorem o tema (`bg-white`, `text-black` direto)
- ❌ Criar paleta nova "por cima" do tema existente

### SEMPRE fazer:
- ✅ Consultar o sistema de temas ANTES de definir cores
- ✅ Testar: "se o usuário trocar de tema, esse componente vai se adaptar?"

---

## TAILWIND CSS — PADRÃO OBRIGATÓRIO

- Tailwind CSS é a única solução de estilização permitida
- Sem CSS-in-JS, sem CSS Modules, sem SASS/LESS
- Sem CSS global (exceto reset e variáveis CSS)

---

## `cn()` UTILITÁRIO

Sempre usar `cn()` para classes condicionais:

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## RESPONSIVIDADE — MOBILE FIRST

```tsx
// ✅ Correto — mobile first
<div className="flex flex-col gap-4 md:flex-row md:gap-8">

// ❌ Errado — desktop first
<div className="flex flex-row gap-8 max-md:flex-col">
```

| Prefixo | Breakpoint |
|---------|-----------|
| (sem) | 0px+ |
| `sm:` | 640px+ |
| `md:` | 768px+ |
| `lg:` | 1024px+ |
| `xl:` | 1280px+ |

---

## DARK MODE

- `class` strategy: `darkMode: 'class'` no Tailwind config
- `dark:` em todos os elementos visíveis
- Toggle via atributo `class="dark"` no `<html>`

```tsx
<div className="bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
```

---

## ANIMAÇÕES

1. Tailwind (`transition-*`) — para hover, focus
2. Framer Motion — para animações de entrada/saída, gestos
3. CSS keyframes — para animações de loop (loading, skeleton)

### Durations padrão
- Hover/focus: 100-150ms
- Dropdowns/tooltips: 200ms
- Modais/drawers: 250-300ms
- Animações de página: 400ms

---

## PROIBIÇÕES

- ❌ `style={{}}` para valores estáticos
- ❌ `!important`
- ❌ Cores hardcoded nas classes (use tokens, não `text-[#6366f1]`)
- ❌ `@apply` exceto para skeletons e resets
