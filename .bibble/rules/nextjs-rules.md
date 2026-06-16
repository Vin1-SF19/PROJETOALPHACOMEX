# NEXTJS RULES — PADRÕES OBRIGATÓRIOS

Este arquivo é lido por TODOS os agentes antes de qualquer ação.
Violações são bloqueadas por Lens (reviewer).

---

## ARQUITETURA

### App Router (obrigatório)
- Usar exclusivamente o App Router (`app/`)
- Pages Router (`pages/`) proibido em projetos novos
- Estrutura de rotas: `app/[segmento]/page.tsx`

### Estrutura de pastas
```
src/
├── app/                    # Rotas e páginas
│   ├── (public)/           # Grupo de rotas públicas
│   ├── (auth)/             # Rotas autenticadas
│   ├── api/                # Route Handlers
│   └── layout.tsx          # Layout raiz
├── components/
│   ├── ui/                 # Componentes base (shadcn)
│   └── [feature]/          # Componentes de feature
├── lib/
│   ├── db.ts               # Cliente Prisma
│   └── utils.ts            # Funções utilitárias gerais
├── hooks/                  # Custom hooks (client-side)
├── actions/                # Server Actions
├── types/                  # TypeScript types globais
└── validations/            # Schemas Zod compartilhados
```

---

## TYPESCRIPT

- TypeScript estrito: `"strict": true` no tsconfig
- **Nunca** usar `any` — use `unknown` e faça type narrowing
- **Nunca** usar `as` para forçar tipos sem verificação
- Interfaces para props de componentes
- Types para unions, primitivos e utilitários
- `satisfies` ao invés de `as` quando possível

---

## SERVER vs CLIENT COMPONENTS

### Server Components (padrão)
- Todo componente é Server Component por padrão
- Podem fazer fetch direto, acessar banco, ler env vars
- Não têm acesso a: useState, useEffect, event handlers, browser APIs
- Preferir sempre que possível — menor bundle, melhor performance

### Client Components
- Adicionar `'use client'` apenas quando necessário
- Necessário para: useState, useEffect, event handlers, hooks do browser
- Empurrar o `'use client'` o mais para baixo possível na árvore

### Regra de ouro
```
Page → Server Component (fetch data)
  └── PageContent → Server Component (renderiza estrutura)
        └── InteractiveWidget → Client Component (apenas a parte interativa)
```

---

## FETCH E DADOS

### No servidor
```typescript
async function Page() {
  const data = await fetch('...', { next: { revalidate: 3600 } })
  return <Component data={data} />
}
```

### No cliente
```typescript
// React Query — nunca useEffect para fetch
const { data, isLoading } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => fetchResource(id),
})
```

### Proibido
```typescript
// ❌ NUNCA
useEffect(() => {
  fetch('/api/data').then(res => res.json()).then(setData)
}, [])
```

---

## SERVER ACTIONS

```typescript
'use server'
import { auth } from '@/auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

export async function createResource(formData: FormData) {
  const session = await auth()
  if (!session) throw new Error('Não autenticado')

  const schema = z.object({ name: z.string().min(1) })
  const result = schema.safeParse(Object.fromEntries(formData))
  if (!result.success) return { error: result.error.flatten() }

  const resource = await db.resource.create({ data: { ...result.data, userId: session.user.id } })
  revalidatePath('/resources')
  return { success: true, data: resource }
}
```

---

## AUTENTICAÇÃO — NEXT-AUTH v5

```typescript
// Server Component
import { auth } from '@/auth'
const session = await auth()

// Route Handler
export const GET = auth(async (req) => {
  const session = req.auth
})
```

---

## FORMULÁRIOS

- React Hook Form + Zod = padrão obrigatório
- Schema Zod compartilhado entre frontend e backend
- Nunca validar manualmente (if/else no formulário)

---

## ESTADO GLOBAL

| Necessidade | Solução |
|-------------|---------|
| Dados do servidor | React Query |
| Estado de UI simples | useState local |
| Estado global de UI | Zustand |
| Formulários | React Hook Form |

---

## PROIBIÇÕES ABSOLUTAS

- ❌ `console.log` em código de produção
- ❌ `any` no TypeScript
- ❌ `useEffect` para fetch de dados
- ❌ `<img>` — sempre `next/image`
- ❌ Hardcode de URLs, segredos ou configurações
- ❌ `dangerouslySetInnerHTML` sem sanitização prévia
