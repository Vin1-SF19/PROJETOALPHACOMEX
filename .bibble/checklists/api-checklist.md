# Checklist: API Route / Server Action

**Usado por:** Echo (implementa), Anubis (auditoria), Lens (revisão)  
**Quando:** Ao criar ou modificar qualquer route handler ou server action  

---

## Route Handler — Checklist Obrigatório

### Estrutura
- [ ] Localizado em `app/api/[rota]/route.ts`
- [ ] Exporta funções nomeadas: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- [ ] `NextRequest` + `NextResponse` importados (ou Response nativa)

### Autenticação
- [ ] Sessão verificada NO INÍCIO (antes de qualquer processamento)
- [ ] Return 401 quando não autenticado
- [ ] Formato: `{ success: false, error: 'Não autenticado' }`

### Validação
- [ ] Schema Zod definido para body/params
- [ ] `safeParse` usado (não `parse` que lança exceção)
- [ ] Return 400 com detalhes quando validação falha
- [ ] Nenhum campo sensível ou de role aceito como input

### Autorização
- [ ] Ownership verificado quando operando em recurso de usuário
- [ ] Return 403 quando userId não bate
- [ ] Return 404 quando recurso não existe (não 403, para não revelar existência)

### Processamento
- [ ] Try/catch em toda operação de banco
- [ ] Return 500 em erros inesperados (sem expor stack trace)
- [ ] `console.error` para log do erro no servidor
- [ ] `select` restrito em queries Prisma

### Respostas
- [ ] 200 para GET bem-sucedido
- [ ] 201 para POST que cria recurso
- [ ] 400 para validação inválida
- [ ] 401 para não autenticado
- [ ] 403 para sem permissão
- [ ] 404 para não encontrado
- [ ] 500 para erro interno

### Formato de resposta
- [ ] `{ success: true, data: ... }` para sucesso
- [ ] `{ success: false, error: "...", details?: ... }` para erro
- [ ] Nenhum campo extra vazando (timestamps internos, IDs de sessão, etc.)

---

## Server Action — Checklist Obrigatório

### Estrutura
- [ ] `'use server'` no topo do arquivo
- [ ] Localizado em `src/actions/[nome].ts`
- [ ] Função exportada com nome descritivo

### Autenticação
- [ ] Sessão verificada antes de qualquer operação
- [ ] Throw ou return `{ error: 'Não autenticado' }` quando sem sessão

### Validação
- [ ] Schema Zod para dados do form/input
- [ ] Validar antes de qualquer escrita no banco

### Retorno
- [ ] Return `{ success: true }` ou `{ success: true, data: ... }`
- [ ] Return `{ error: '...' }` em casos de erro
- [ ] `revalidatePath()` após writes que invalidam cache

---

## Template Básico — Route Handler

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const createSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function POST(request: NextRequest) {
  // 1. Auth
  const session = await getSession() // método do projeto
  if (!session) {
    return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
  }

  try {
    // 2. Parse e validate
    const body = await request.json()
    const result = createSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // 3. Business logic
    const resource = await db.resource.create({
      data: { ...result.data, userId: session.user.id },
      select: { id: true, name: true, createdAt: true },
    })

    return NextResponse.json({ success: true, data: resource }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/resource]', error)
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 })
  }
}
```

---

## Score

Contar itens marcados. Todos devem estar marcados antes do push.
