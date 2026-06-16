# Workflow: New Project Setup

**Trigger:** Projeto novo instalou o Bibble Squad  
**Responsável:** Bibble orquestra, Scribe e Atlas executam  
**Quando usar:** Primeira vez usando o squad em um projeto  

---

## Descrição

Fluxo de onboarding para um projeto recém-chegado ao Bibble Squad. Configura a memória base do projeto para que todos os agentes tenham contexto correto.

## Fluxo

```
Atlas (tokens) → Scribe (mapeia codebase) → Bibble (configura memória base)
```

---

## Fase 1 — Análise Visual (Atlas) — Opcional

Se o projeto tem design visual definido:

**Task:** `tasks/atlas-extract-tokens.md`

Atlas analisa:
- Paleta de cores do projeto
- Tipografia usada
- Padrões visuais identificados

---

## Fase 2 — Mapeamento do Codebase (Scribe)

Scribe lê o projeto e preenche `.bibble/memory/architecture.md`:

```markdown
## Stack
| Área | Tecnologia |
|------|-----------|
| Framework | Next.js [versão] + App Router |
| Auth | [Next-Auth / Clerk / Custom] |
| Banco | [SQLite / PostgreSQL / MySQL] |
| ORM | [Prisma / Drizzle / custom] |
| Estilização | [Tailwind v4 / v3 / CSS Modules] |
| Estado global | [Zustand / Redux / Context] |
| Upload | [UploadThing / Vercel Blob / custom] |
| Email | [Resend / SendGrid / SMTP] |
| AI | [Claude / OpenAI / Gemini] |
| Real-time | [Pusher / Socket.io / None] |
```

Scribe lê a estrutura e preenche `.bibble/memory/codebase-map.md`:

```
src/
├── app/
│   ├── [rota1]/page.tsx
│   └── api/[endpoint]/route.ts
├── components/
│   └── [componentes existentes]
└── lib/
    └── [utilitários existentes]
```

---

## Fase 3 — Integration Points (Scout)

Scout lê o projeto e identifica:
- Como funciona a navegação/menu?
- Existe sidebar? Onde está?
- Existe sistema de permissões? Qual arquivo?
- Existe lista de módulos? Qual arquivo e variável?
- Existe sistema de atalhos? Qual arquivo?

Salvar tudo em `.bibble/memory/integration-points.md`.

---

## Fase 4 — Configurações de Auth (Bibble)

Bibble ajuda o usuário a preencher:
- Sistema de auth utilizado
- Como verificar sessão (código de exemplo)
- Como pegar userId da sessão

Adicionar em `.bibble/memory/decisions.md`:
```markdown
## [Data] — Sistema de Autenticação
**Decisão:** Usar [Next-Auth v5 / Clerk / etc.]
**Como verificar sessão:**
```typescript
// Exemplo específico do projeto
import { auth } from '@/auth'
const session = await auth()
```
**Como pegar userId:** `session?.user?.id`
```

---

## Fase 5 — Checklist de Onboarding

```markdown
## New Project Setup — Checklist

### Memória configurada
- [ ] architecture.md — stack documentada
- [ ] codebase-map.md — estrutura mapeada
- [ ] integration-points.md — pontos de integração identificados
- [ ] decisions.md — sistema de auth documentado

### Design tokens (opcional)
- [ ] design-tokens.md — cores e tipografia extraídas

### Componentes existentes
- [ ] components.md — catálogo inicial criado

### Verificação
- [ ] Bibble consegue responder: "qual banco usa o projeto?"
- [ ] Scout consegue mapear onde adicionar um novo módulo no menu
- [ ] DevOps conhece a estratégia de deploy do projeto
```

---

## Output Final

```markdown
## Bibble Squad — Projeto Configurado ✅

### Projeto: [Nome]
### Data: [YYYY-MM-DD]

### Memória preenchida
- architecture.md ✅
- codebase-map.md ✅
- integration-points.md ✅
- decisions.md ✅

### Stack identificada
- Framework: [X]
- Auth: [X]
- Banco: [X]

### Próximos passos recomendados
1. Use `/bibble` para qualquer tarefa — Bibble orquestra a squad
2. Use `/scout` antes de qualquer implementação nova
3. Use `/pm` para criar PRDs e planejar features
```
