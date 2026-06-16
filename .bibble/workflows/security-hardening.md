# Workflow: Security Hardening

**Trigger:** Auditoria de segurança completa, pré-launch, ou após incidente  
**Responsável:** Anubis (lidera), Lens (revisa código), DataEngineer (banco)  
**Quando usar:** Antes de lançar para produção, auditoria trimestral, após vulnerabilidade descoberta  

---

## Descrição

Auditoria completa de segurança de toda a aplicação: autenticação, autorização, dados, AI, infraestrutura.

## Fluxo

```
Anubis (auth/API) → DataEngineer (banco) → Lens (código) → Relatório Final
```

---

## Fase 1 — Mapeamento da Superfície de Ataque

Anubis mapeia todos os pontos de entrada:

```markdown
## Superfície de Ataque

### Entradas HTTP
- [ ] [N] Route Handlers listados
- [ ] [N] Server Actions listadas
- [ ] [N] Webhooks externos

### Dados sensíveis identificados
- [ ] Campos de senha/hash
- [ ] Tokens de API
- [ ] Dados pessoais (CPF, e-mail, telefone)
- [ ] Dados financeiros

### AI/LLM
- [ ] Tools com acesso a banco
- [ ] Tools com acesso a sistema de arquivos
- [ ] Prompts com dados de usuário
```

---

## Fase 2 — Auditoria de Autenticação

**Task:** `tasks/security-audit.md` — seção Auth

Verificar:
- [ ] Todas as rotas protegidas têm `auth()` no início
- [ ] Session validation antes de QUALQUER operação
- [ ] JWT/Session tokens com expiração adequada
- [ ] Refresh token rotation implementado
- [ ] Logout destrói a sessão no servidor (não só no cliente)
- [ ] CSRF protection ativa
- [ ] Rate limiting no login (`/api/auth/*`)

---

## Fase 3 — Auditoria de Autorização (IDOR)

Para CADA resource no sistema:

```typescript
// Verificar padrão em todos os endpoints:
const resource = await db.X.findUnique({ where: { id } })
if (!resource) return 404
if (resource.userId !== session.user.id) return 403
```

Checklist:
- [ ] Ownership check em 100% dos recursos do usuário
- [ ] Admins têm acesso só ao que deveriam ter
- [ ] Nenhum endpoint expõe dados de outros usuários
- [ ] Paginação não vaza IDs sequenciais

---

## Fase 4 — Auditoria de Banco (DataEngineer)

DataEngineer verifica:

```sql
-- Dados sensíveis com acesso irrestrito?
-- Senhas em plain text?
-- Tokens não hasheados?
-- Dados de usuário sem isolamento?
```

Checklist:
- [ ] Senhas armazenadas com bcrypt/argon2 (nunca plain text)
- [ ] Tokens de reset/magic link com expiração curta (< 1 hora)
- [ ] Dados sensíveis com select restrito em todos os endpoints
- [ ] Logs não contêm dados sensíveis
- [ ] Backups encriptados

---

## Fase 5 — Auditoria de AI/LLM (Anubis)

Se o projeto tem assistente AI:

```typescript
// Verificar CADA tool:
// 1. userId passado e validado?
// 2. Query filtra por userId?
// 3. Resultado não vaza dados de outros usuários?
// 4. Input do usuário sanitizado antes de ir ao prompt?
// 5. Output da AI sanitizado antes de renderizar?
```

Checklist:
- [ ] Todas as tools com ownership por userId
- [ ] API key nunca exposta ao cliente
- [ ] Rate limit por usuário na API de AI
- [ ] Prompt injection considerada e mitigada
- [ ] Outputs da AI não renderizados como HTML sem sanitização

---

## Fase 6 — Auditoria de Infraestrutura

DevOps verifica:

- [ ] Headers de segurança configurados
- [ ] HTTPS forçado
- [ ] Variáveis de ambiente em produção (não hardcoded)
- [ ] `.env` no `.gitignore`
- [ ] Dependências sem vulnerabilidades conhecidas (`npm audit`)

```bash
# Verificar dependências
npm audit

# Headers de segurança (Next.js)
# next.config.ts
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
]
```

---

## Relatório Final

```markdown
## Bibble Squad — Security Hardening Report
**Data:** [YYYY-MM-DD]
**Versão analisada:** [commit hash ou versão]

### Executive Summary
[2-3 linhas resumindo o estado geral de segurança]

### Vulnerabilidades encontradas

#### 🔴 CRÍTICAS (corrigir AGORA, não fazer push sem resolver)
| ID | Local | Descrição | Fix |
|----|-------|-----------|-----|
| SEC-001 | [arquivo:linha] | [descrição] | [fix] |

#### 🟡 IMPORTANTES (corrigir antes do próximo release)
[...]

#### 🟢 MELHORIA FUTURA (backlog de segurança)
[...]

### Score de Segurança
| Área | Score |
|------|-------|
| Autenticação | [A/B/C/D] |
| Autorização | [A/B/C/D] |
| Dados | [A/B/C/D] |
| AI/LLM | [A/B/C/D] |
| Infraestrutura | [A/B/C/D] |
| **Total** | **[A/B/C/D]** |

### Próxima auditoria recomendada: [data]
```

## Critérios de Conclusão

- Zero vulnerabilidades críticas antes do push para produção
- Issues importantes documentadas e priorizadas no backlog
- Relatório salvo em `.bibble/memory/decisions.md`
