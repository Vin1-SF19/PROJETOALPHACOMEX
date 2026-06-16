# Task: Security Audit

**Agente:** Anubis  
**Quando usar:** Sempre que houver código de auth, API, AI, upload ou dados sensíveis  
**Output:** Relatório de segurança com classificação de riscos  

---

## Objetivo

Auditar o código em busca de vulnerabilidades OWASP, vazamentos de dados, IDOR, prompt injection e falhas de autenticação/autorização.

## Pré-condições

- Código implementado (pode ser auditado antes de Forge)
- Acesso ao código de auth, API routes e tools de AI

## Passos

### Passo 1 — Identificar superfície de ataque

Localizar todos os pontos de entrada:
- Route Handlers (`app/api/**/*.ts`)
- Server Actions (`src/actions/**/*.ts`)
- Tools de AI (`lib/*/tools.ts`)
- Uploads e processamento de arquivos
- Formulários com dados sensíveis

### Passo 2 — Auditoria de Autenticação

```typescript
// Verificar em CADA route/action:

// ❌ VULNERÁVEL — sem auth
export async function GET(request: Request) {
  const data = await db.user.findMany()
  return Response.json(data)
}

// ✅ SEGURO
export async function GET(request: Request) {
  const session = await getSession() // ou método de auth do projeto
  if (!session) return new Response('Unauthorized', { status: 401 })
  // ...
}
```

**Checklist de Auth:**
- [ ] Toda route protegida verifica sessão no início
- [ ] Server Actions verificam sessão antes de qualquer operação
- [ ] Tokens não expostos ao cliente (`ANTHROPIC_API_KEY`, `DATABASE_URL`, etc.)
- [ ] Cookies de sessão com `httpOnly`, `secure`, `sameSite`

### Passo 3 — Auditoria de Autorização (IDOR)

```typescript
// ❌ IDOR — usuário A pode ler dados do usuário B
export async function GET(req, { params }) {
  const data = await db.document.findUnique({ where: { id: params.id } })
  return Response.json(data)
}

// ✅ SEGURO — verifica ownership
export async function GET(req, { params }) {
  const session = await getSession()
  const data = await db.document.findUnique({ where: { id: params.id } })
  if (!data) return new Response('Not Found', { status: 404 })
  if (data.userId !== session.user.id) return new Response('Forbidden', { status: 403 })
  return Response.json(data)
}
```

**Checklist de Autorização:**
- [ ] Ownership verificado em TODOS os recursos por `userId`
- [ ] Admin routes verificam role explicitamente
- [ ] IDs em URLs nunca confiar sem verificar ownership

### Passo 4 — Auditoria de Validação

```typescript
// ❌ SEM VALIDAÇÃO
export async function POST(req) {
  const { name, role } = await req.json()
  await db.user.create({ data: { name, role } }) // role pode ser 'admin'!
}

// ✅ COM VALIDAÇÃO
const schema = z.object({
  name: z.string().min(1).max(100),
  // role não é aceito como input — definido internamente
})
export async function POST(req) {
  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return Response.json({ error: result.error }, { status: 400 })
  await db.user.create({ data: { name: result.data.name, role: 'user' } })
}
```

**Checklist de Validação:**
- [ ] Zod em todos os endpoints
- [ ] Nenhum campo sensível aceito como input sem whitelist explícita
- [ ] Tamanho máximo de strings validado
- [ ] Tipos numéricos com min/max

### Passo 5 — Auditoria de AI Security (se houver Bibble/AI)

```typescript
// Verificar CADA tool de AI:

// ❌ VULNERÁVEL — sem ownership
case 'buscar_cliente':
  return await db.cliente.findMany({ where: { nome: input.query } })

// ✅ SEGURO — com ownership
case 'buscar_cliente':
  return await db.cliente.findMany({
    where: { userId, nome: { contains: input.query } }, // userId obrigatório
    take: 5, // limite obrigatório
  })
```

**Checklist de AI Security:**
- [ ] Todas as tools filtram por `userId` (sem exceção)
- [ ] `ANTHROPIC_API_KEY` nunca exposta ao cliente
- [ ] Chamadas à API de AI apenas no servidor
- [ ] Outputs de AI sanitizados antes de renderizar
- [ ] Rate limit por usuário implementado (ou planejado)
- [ ] Nenhum dado de outro usuário acessível via tool

### Passo 6 — Auditoria de XSS e Injection

```typescript
// ❌ XSS — renderizar HTML não sanitizado
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ SEGURO — sanitizar antes
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

**Checklist XSS/Injection:**
- [ ] `dangerouslySetInnerHTML` sem sanitização prévia? (CRÍTICO)
- [ ] Inputs de usuário renderizados diretamente? 
- [ ] SQL construído com concatenação de strings?
- [ ] Shell commands com input de usuário?

### Passo 7 — Auditoria de Secrets

```bash
# Verificar se há segredos hardcoded
grep -r "api_key\|API_KEY\|secret\|password\|token" --include="*.ts" --include="*.tsx" src/ lib/
```

**Checklist de Secrets:**
- [ ] Nenhum secret hardcoded no código
- [ ] Todas as chaves via `process.env`
- [ ] `.env.example` existe sem valores reais
- [ ] `.env` no `.gitignore`

## Output

```markdown
## Anubis — Security Audit

### Superfície analisada
- [N] route handlers
- [N] server actions
- [N] AI tools

### Vulnerabilidades encontradas

#### 🔴 CRÍTICO (bloqueia entrega)
- [arquivo:linha] — [descrição] — [fix recomendado]

#### 🟡 WARNING (deve corrigir antes do próximo release)
- [arquivo:linha] — [descrição] — [fix recomendado]

#### 🟢 INFORMAÇÃO (melhoria futura)
- [arquivo:linha] — [observação]

### Checklist de Auth
- [x] Auth verificada em todos os endpoints
- [x] Ownership verificada em todos os recursos
- [x] Secrets via env vars

### Veredicto
[APROVADO / APROVADO COM RESSALVAS / REPROVADO]
→ [Ação necessária]
```

## Critérios de Sucesso

- Todos os endpoints auditados
- Zero vulnerabilidades críticas
- IDOR verificado em todos os recursos
- AI tools com ownership (se aplicável)
- Relatório com classificação por severidade
