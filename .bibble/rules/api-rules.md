# API RULES — PADRÕES DE API E BACKEND

Lido por: Echo (backend), Lens (reviewer), Bibble (master)

---

## RESPOSTA PADRONIZADA

### Sucesso
```json
{ "success": true, "data": {}, "message": "Operação realizada com sucesso" }
```

### Sucesso com lista paginada
```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

### Erro de validação (400)
```json
{ "success": false, "error": "Validation error", "details": [...] }
```

### Erro de negócio (4xx)
```json
{ "success": false, "error": "Recurso não encontrado", "code": "RESOURCE_NOT_FOUND" }
```

### Erro interno (500)
```json
{ "success": false, "error": "Erro interno do servidor" }
```

---

## HTTP STATUS CODES

| Situação | Code |
|----------|------|
| Leitura bem-sucedida | 200 |
| Criação bem-sucedida | 201 |
| Erro de validação | 400 |
| Não autenticado | 401 |
| Sem permissão | 403 |
| Não encontrado | 404 |
| Rate limit | 429 |
| Erro interno | 500 |

---

## ESTRUTURA DE ROUTE HANDLER

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { db } from '@/lib/db'

const createSchema = z.object({
  name: z.string().min(1).max(100),
})

export const POST = auth(async (req) => {
  if (!req.auth) return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })

  try {
    const body = await req.json()
    const result = createSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Dados inválidos', details: result.error.flatten().fieldErrors }, { status: 400 })
    }

    const resource = await db.resource.create({
      data: { ...result.data, userId: req.auth.user.id },
      select: { id: true, name: true, createdAt: true },
    })

    return NextResponse.json({ success: true, data: resource }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/resource]', error)
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 })
  }
})
```

---

## PRISMA — BOAS PRÁTICAS

```typescript
// lib/db.ts — cliente singleton
import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const db = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

### Proibido no Prisma
```typescript
// ❌ findMany sem limit
await db.user.findMany()

// ❌ Select sem especificar campos em tabelas com dados sensíveis
await db.user.findUnique({ where: { id } }) // retorna password!

// ❌ N+1 query
for (const post of posts) {
  const author = await db.user.findUnique({ where: { id: post.authorId } })
}
```

---

## SEGURANÇA OBRIGATÓRIA

1. Input sanitization: Zod em todos os endpoints
2. Auth check: verificar sessão antes de qualquer operação
3. Ownership check: recurso pertence ao usuário autenticado?
4. Logs seguros: nunca logar senha, token, CPF/CNPJ
5. Env vars: nunca hardcode de secrets

### Verificação de ownership
```typescript
const resource = await db.resource.findUnique({ where: { id } })
if (!resource) return NextResponse.json({ success: false, error: 'Não encontrado' }, { status: 404 })
if (resource.userId !== session.user.id) return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 })
```
