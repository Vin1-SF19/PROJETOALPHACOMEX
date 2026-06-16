# Checklist: React Component

**Usado por:** Nova (implementa), Lens (revisão)  
**Quando:** Ao criar qualquer novo componente React  

---

## Antes de Criar — Verificações Obrigatórias

- [ ] Consultou `.bibble/memory/components.md` — componente similar não existe?
- [ ] Consultou `src/components/ui/` — componente base (shadcn) não atende?
- [ ] Definiu se é Server ou Client Component

---

## Estrutura do Componente

### Arquivo
- [ ] Localizado em `src/components/[Feature]/[ComponentName].tsx`
- [ ] Nome em PascalCase, igual ao nome do componente exportado
- [ ] Exportação nomeada (não default export — facilita refactor)

### Props
- [ ] Interface `[ComponentName]Props` definida (não inline type)
- [ ] Nenhum prop com tipo `any`
- [ ] Props opcionais com `?` e valor default quando possível
- [ ] `className?: string` para estilização externa

### TypeScript
- [ ] Nenhum `any` no componente
- [ ] `satisfies` ao invés de `as` quando possível
- [ ] Event handlers tipados corretamente (`React.MouseEvent`, etc.)

---

## Server vs Client

### Server Component (padrão — preferir sempre)
- [ ] Sem `'use client'`
- [ ] Sem hooks de estado (useState, useEffect, etc.)
- [ ] Pode fazer fetch, ler DB, acessar env vars
- [ ] Passa dados como props para client components filhos

### Client Component (só quando necessário)
- [ ] `'use client'` no topo
- [ ] Necessário porque usa: useState / useEffect / event handlers / hooks do browser
- [ ] Está o mais baixo possível na árvore de componentes
- [ ] Props serializáveis (sem funções complexas de server para client)

---

## Renderização e UX

- [ ] Estado de **loading** tratado (Skeleton, Spinner, ou fallback)
- [ ] Estado de **erro** tratado com mensagem útil ao usuário
- [ ] Estado de **vazio** tratado (empty state com call to action)
- [ ] Estado de **sucesso** claro quando houver ação

---

## Estilização

- [ ] Tailwind CSS usado (sem CSS inline, salvo casos excepcionais)
- [ ] `cn()` helper usado para classes condicionais
- [ ] Responsivo (mobile-first: `sm:`, `md:`, `lg:`)
- [ ] Dark mode funcionando (se o projeto usa `dark:`)
- [ ] Tokens de design usados (variáveis CSS do projeto)
- [ ] Sem `<img>` — sempre `next/image`

---

## Acessibilidade

- [ ] Elementos interativos com atributos ARIA quando necessário
- [ ] Imagens com `alt` descritivo (não vazio sem ser decorativo)
- [ ] Contraste de cores adequado (WCAG AA)
- [ ] Focável via teclado
- [ ] Labels em inputs de formulário
- [ ] Botões com texto ou `aria-label`

---

## Performance

- [ ] Sem re-renders desnecessários (memo, useCallback se necessário)
- [ ] Sem `useEffect` para fetch de dados (usar React Query ou Server Component)
- [ ] Imports pesados com dynamic import se não críticos ao load inicial
- [ ] Listas longas com virtualização se > 100 itens

---

## Variantes (se o componente tem variações)

```typescript
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'base-classes-always-applied',
  {
    variants: {
      variant: {
        default: 'variant-classes',
        destructive: 'variant-classes',
      },
      size: {
        sm: 'size-classes',
        md: 'size-classes',
        lg: 'size-classes',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}
```

- [ ] CVA usado para variantes (não múltiplos `if/else`)
- [ ] `defaultVariants` definido

---

## Após Criar

- [ ] Adicionar ao `.bibble/memory/components.md`
- [ ] Adicionar `className` prop para extensibilidade
- [ ] Storybook/exemplo criado (se o projeto usa)
