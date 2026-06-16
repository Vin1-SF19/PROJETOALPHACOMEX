# Task: Performance Check

**Agente:** Flux  
**Quando usar:** Antes de releases, quando bundle crescer muito, ou quando usuário reclamar de lentidão  
**Output:** Relatório de performance com recomendações priorizadas  

---

## Objetivo

Identificar gargalos de performance: bundle size, Core Web Vitals, queries lentas, cache ineficiente, renders desnecessários.

## Passos

### Passo 1 — Bundle Analysis

```bash
# Gerar relatório de bundle
ANALYZE=true npm run build
# ou
npx @next/bundle-analyzer
```

Verificar:
- Total bundle size
- Chunks maiores que 100kb
- Libs duplicadas
- Imports não usados

**Thresholds:**
- Page JavaScript: < 75kb (ideal < 50kb)
- Total First Load JS: < 130kb
- Chunk individual: < 244kb

### Passo 2 — Core Web Vitals (se app rodando)

Métricas alvo:
| Métrica | Boa | Precisa Melhorar | Ruim |
|---------|-----|-----------------|------|
| LCP | < 2.5s | 2.5-4.0s | > 4.0s |
| FID/INP | < 100ms | 100-300ms | > 300ms |
| CLS | < 0.1 | 0.1-0.25 | > 0.25 |

Verificar no DevTools → Lighthouse ou Performance.

### Passo 3 — Análise de Rendering

```tsx
// Verificar Server vs Client components
// ❌ Client component desnecessário
'use client'
export function StaticCard({ title, description }: Props) {
  return <div><h2>{title}</h2><p>{description}</p></div>
}

// ✅ Server component (sem 'use client' = server por padrão)
export function StaticCard({ title, description }: Props) {
  return <div><h2>{title}</h2><p>{description}</p></div>
}
```

Verificar:
- [ ] Pages são Server Components?
- [ ] `'use client'` usado apenas onde necessário?
- [ ] Componentes pesados com dynamic import?

```tsx
// Dynamic import para componentes pesados
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <p>Carregando gráfico...</p>,
  ssr: false,
})
```

### Passo 4 — Análise de Imagens

```tsx
// ❌ Sem otimização
<img src="/hero.png" alt="Hero" />

// ✅ Next.js Image
import Image from 'next/image'
<Image
  src="/hero.png"
  alt="Hero"
  width={800}
  height={400}
  priority  // para imagens above-the-fold
  placeholder="blur"
/>
```

Verificar:
- [ ] Todas as imagens usando `next/image`?
- [ ] Imagens `priority` para above-the-fold?
- [ ] Imagens com dimensões especificadas?
- [ ] Formato WebP/AVIF disponível?

### Passo 5 — Análise de Fetch e Cache

```typescript
// Verificar revalidação nas queries de servidor
// ❌ Sem cache
const data = await fetch('https://api.example.com/data')

// ✅ Com revalidação
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 } // 1 hora
})

// ✅ Cache estático (dados que nunca mudam)
const data = await fetch('...', { cache: 'force-cache' })

// ✅ Sem cache (dados sempre frescos)
const data = await fetch('...', { cache: 'no-store' })
```

### Passo 6 — Queries Lentas

Identificar queries problemáticas:
- N+1 queries em loops
- `findMany` sem `take`
- Falta de índices em campos filtrados
- JOINs sem índice no campo FK

```typescript
// ❌ N+1
const posts = await db.post.findMany()
for (const post of posts) {
  const user = await db.user.findUnique({ where: { id: post.userId } })
}

// ✅ Include
const posts = await db.post.findMany({
  include: { user: { select: { name: true } } },
  take: 20,
})
```

### Passo 7 — Análise de Fonts

```typescript
// next/font — carrega localmente, sem layout shift
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], display: 'swap' })

// ❌ Google Fonts no head — latência adicional
<link href="https://fonts.googleapis.com/..." />
```

## Output

```markdown
## Flux — Performance Check

### Bundle Size
- Total First Load JS: [X]kb [✅/⚠️/❌]
- Chunks problemáticos: [lista]

### Core Web Vitals (se medido)
- LCP: [X]s [✅/⚠️/❌]
- INP: [X]ms [✅/⚠️/❌]
- CLS: [X] [✅/⚠️/❌]

### Issues encontradas

#### 🔴 Alto Impacto
- [arquivo] — [problema] — [fix]

#### 🟡 Médio Impacto
- [arquivo] — [problema] — [fix]

#### 🟢 Melhoria Opcional
- [observação]

### Recomendações prioritárias
1. [fix mais importante]
2. [segundo fix]
3. [terceiro fix]

### Estimativa de ganho
[Ganho estimado após aplicar fixes críticos]
```

## Critérios de Sucesso

- Bundle size dentro dos thresholds
- Imagens todas com `next/image`
- Sem N+1 queries óbvias
- Server Components onde possível
- Relatório com priorização clara
