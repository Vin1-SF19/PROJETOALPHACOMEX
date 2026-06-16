# API Spec: [NOME DO ENDPOINT]

**Agente:** Echo  
**Data:** [YYYY-MM-DD]  
**Status:** Draft | Implementado | Depreciado  

---

## Visão Geral

| Propriedade | Valor |
|-------------|-------|
| Método | GET / POST / PUT / PATCH / DELETE |
| Rota | `/api/[caminho]` |
| Auth | Obrigatória / Pública |
| Rate limit | [N req/min ou N/A] |

---

## Request

### Headers
```
Authorization: Bearer [token] — ou via cookie de sessão
Content-Type: application/json
```

### Path Params (se aplicável)
| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID do recurso |

### Query Params (se GET com filtros)
| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `page` | `number` | não (default: 1) | Página |
| `limit` | `number` | não (default: 20) | Itens por página |
| `search` | `string` | não | Busca por texto |

### Body (se POST/PUT/PATCH)

```typescript
// Zod Schema
const requestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

type RequestBody = z.infer<typeof requestSchema>
```

```json
// Exemplo de request
{
  "name": "Nome do recurso",
  "description": "Descrição opcional"
}
```

---

## Response

### 200 OK (GET)
```json
{
  "success": true,
  "data": {
    "id": "clxxxxx",
    "name": "Nome do recurso",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 200 OK (GET — lista paginada)
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 201 Created (POST)
```json
{
  "success": true,
  "data": {
    "id": "clxxxxx",
    "name": "Nome criado",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Dados inválidos",
  "details": {
    "name": ["Campo obrigatório"]
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Não autenticado"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Sem permissão para este recurso"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Recurso não encontrado"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Erro interno do servidor"
}
```

---

## Segurança

| Item | Implementado |
|------|-------------|
| Auth verificada no início | [ ] |
| Ownership check (userId) | [ ] |
| Zod validation no body | [ ] |
| Rate limiting | [ ] |
| Select restrito (sem dados sensíveis) | [ ] |

---

## Implementação

```typescript
// app/api/[rota]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const bodySchema = z.object({
  // definir aqui
})

export async function POST(request: NextRequest) {
  // Auth
  // Validate
  // Business logic
  // Return
}
```

---

## Changelog

| Versão | Data | Mudança |
|--------|------|---------|
| 1.0 | [data] | Criação |
