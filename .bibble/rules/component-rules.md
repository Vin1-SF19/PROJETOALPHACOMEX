# COMPONENT RULES — PADRÕES DE COMPONENTES

Lido por: Nova (front), Lens (reviewer)

---

## PRINCÍPIOS FUNDAMENTAIS

1. **Um componente = uma responsabilidade**
2. **Composição sobre herança**
3. **Props > estado interno** quando possível
4. **Acessibilidade por design** — não como afterthought

---

## ESTRUTURA PADRÃO

```tsx
import { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg transition-colors',
        variant === 'primary' && 'bg-brand-primary text-white hover:bg-brand-primary-hover',
        variant === 'ghost' && 'text-neutral-700 hover:bg-neutral-100',
        size === 'sm' && 'h-8 px-4 text-sm',
        size === 'md' && 'h-10 px-5 text-base',
        (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {children}
    </button>
  )
}
```

---

## `cva` PARA VARIANTES COMPLEXAS

```typescript
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium rounded-lg transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-brand-primary text-white hover:bg-brand-primary-hover',
        secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
      },
      size: {
        sm: 'h-8 px-4 text-sm',
        md: 'h-10 px-5 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)
```

---

## ESTADOS OBRIGATÓRIOS

Todo componente que exibe dados deve ter:

```tsx
// Loading
if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />

// Erro
if (error) return (
  <div className="flex flex-col items-center gap-2 py-8 text-neutral-500">
    <p>Não foi possível carregar os dados.</p>
    <Button variant="ghost" size="sm" onClick={retry}>Tentar novamente</Button>
  </div>
)

// Vazio
if (!data?.length) return (
  <div className="flex flex-col items-center gap-2 py-12 text-neutral-400">
    <p>Nenhum item encontrado</p>
  </div>
)
```

---

## ACESSIBILIDADE OBRIGATÓRIA

- `<button>` para ações (nunca `<div onClick>`)
- `<a href>` para navegação
- `aria-label` quando o texto visível não descreve a ação
- `<label htmlFor>` associado ao input em formulários
- `aria-invalid` quando campo tem erro
- `alt` descritivo em imagens de conteúdo; `alt=""` em decorativas
- Esc fecha modais e dropdowns

---

## REGRAS DE NOMENCLATURA

- Componente: `PascalCase` — `UserCard`
- Props interface: `[Nome]Props` — `UserCardProps`
- Hooks: `use[Nome]` — `useUserData`
- Eventos: `on[Ação]` — `onSubmit`, `onDelete`
- Estado booleano: `is[Estado]` / `has[Algo]` — `isLoading`, `hasError`

---

## PROIBIÇÕES

- ❌ `defaultProps` — use default values no destructuring
- ❌ Lógica de negócio em componentes (extraia para hooks)
- ❌ Fetch direto em Client Components (use React Query)
- ❌ Props com `any`
- ❌ Máximo 300 linhas por componente — se ultrapassar, divida
- ❌ Criar componente que já existe em `.bibble/memory/components.md`

---

## ALPHA CRM — CRIAÇÃO E FORMULÁRIOS POR ETAPA (2026-08-13)

- Cards novos só podem ser criados na etapa **Novos Leads**.
- Colunas posteriores não exibem botão, atalho ou modal de criação direta.
- O modal de criação recebe somente os dados iniciais próprios de Novos Leads; não antecipa formulários de etapas futuras.
- Campos e formulários específicos da etapa atual são exibidos e editados dentro do card, no painel central, na aba **Formulário da Etapa**. Requisitos de avanço continuam no painel esquerdo.
- O formulário de criação/reagendamento do Google Meet só é exibido na etapa **Agendar Reunião**, dentro da aba central **Formulário da Etapa**. Em **Reunião Agendada**, apenas o acompanhamento/transcrição pode ser mostrado, sem formulário de criação.
- A restrição visual nunca substitui o guard do backend: qualquer chamada direta tentando criar fora de Novos Leads deve ser recusada.
