# Task: Dev Develop

**Agente:** Nova (frontend) / Echo (backend) / combinados  
**Quando usar:** Após blueprint do Scout aprovado  
**Output:** Feature implementada seguindo o blueprint  

---

## Objetivo

Implementar a feature especificada no blueprint do Scout, seguindo as rules do projeto e sem desviar do escopo definido.

## Pré-condições

- [x] Blueprint do Scout recebido
- [x] `.bibble/rules/` lidas (nextjs, api, styling, component)
- [x] `.bibble/memory/` consultadas (architecture, decisions, components)

## Passos

### Passo 1 — Preparação

```
Ler: .bibble/rules/nextjs-rules.md
Ler: .bibble/rules/api-rules.md
Ler: .bibble/rules/styling-rules.md
Ler: .bibble/rules/component-rules.md
Ler: .bibble/memory/components.md
Ler: .bibble/memory/decisions.md
```

### Passo 2 — Seguir a ordem do blueprint

Implementar na ordem exata definida pelo Scout no blueprint.
**Não pular itens. Não adicionar itens não listados.**

### Passo 3 — Checklist durante implementação

Para cada arquivo criado ou modificado:

**Frontend (Nova):**
- [ ] TypeScript estrito — nenhum `any`
- [ ] Server Component por padrão, `'use client'` apenas quando necessário
- [ ] `next/image` ao invés de `<img>`
- [ ] React Query para fetch no cliente, nunca `useEffect` para dados
- [ ] Componente verificado em `.bibble/memory/components.md` antes de criar
- [ ] Props tipadas com interface
- [ ] Estados: loading, error, empty, success tratados
- [ ] Responsividade (mobile-first)
- [ ] Dark mode (se o projeto usa)

**Backend (Echo):**
- [ ] Auth verificado no início da route/action
- [ ] Zod validation no body/params
- [ ] Ownership check (recurso pertence ao usuário?)
- [ ] Respostas no formato padrão `{ success, data, error }`
- [ ] Status codes corretos (200/201/400/401/403/404/500)
- [ ] Sem `console.log` em produção
- [ ] `select` restrito em queries (sem dados sensíveis)
- [ ] `take` em todos os `findMany`

**Integration Points (do blueprint):**
- [ ] Menu/navegação atualizado
- [ ] Permissões configuradas
- [ ] Rota criada e protegida
- [ ] Demais integration points do blueprint

### Passo 4 — Auto-revisão

Antes de passar para Forge, fazer uma leitura rápida:
- O código resolve o problema especificado?
- Algum TODO/FIXME ficou no código?
- Algum `console.log` de debug esquecido?
- Alguma variável de ambiente hardcoded?

### Passo 5 — Listar arquivos modificados

Entregar lista completa para Scribe atualizar a memória:

```markdown
## Arquivos criados
- src/app/[rota]/page.tsx
- src/components/[Feature]/[Component].tsx

## Arquivos modificados
- src/components/layout/Sidebar.tsx — adicionado item de menu
- src/app/api/[rota]/route.ts — nova rota

## Schema modificado
- prisma/schema.prisma — [se houve mudança]
```

## Outputs

- Feature implementada
- Lista de arquivos criados/modificados
- Pronto para `build-check` do Forge

## Critérios de Sucesso

- Blueprint seguido integralmente (sem desvios)
- Todos os integration points implementados
- TypeScript estrito (zero `any`)
- Auth verificado em todas as rotas
- Ownership check em todas as operações de usuário
- Código pronto para passar por Forge sem erros
