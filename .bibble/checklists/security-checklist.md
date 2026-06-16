# Checklist: Security

**Usado por:** Anubis (auditoria), Lens (revisão), DevOps (pré-push)  
**Quando:** Em qualquer código com auth, API, AI, upload, ou dados sensíveis  

---

## Autenticação

- [ ] Sessão verificada no início de CADA route handler protegida
- [ ] Sessão verificada no início de CADA server action protegida
- [ ] Response com 401 quando não autenticado (não 403)
- [ ] Logout destrói sessão no servidor (não só limpa cookie)
- [ ] Rate limiting em endpoints de auth (`/api/auth/*`)
- [ ] Tokens/secrets com expiração configurada

## Autorização (IDOR)

- [ ] Ownership check antes de qualquer operação em recurso do usuário
- [ ] Pattern: `if (resource.userId !== session.user.id) return 403`
- [ ] Acesso de admin verificado explicitamente (não só "está logado")
- [ ] IDs de recursos não sequenciais ou não previsíveis

## Validação de Input

- [ ] Zod schema em TODOS os endpoints de escrita
- [ ] Campos whitelist (nunca aceitar campos não esperados)
- [ ] Tamanho máximo de strings definido
- [ ] Tipos numéricos com min/max
- [ ] Nenhum dado de role/admin aceito como input do usuário

## AI Security (se aplicável)

- [ ] `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` nunca no cliente
- [ ] Chamadas de API de AI apenas no servidor
- [ ] Todas as tools filtram por `userId`
- [ ] Rate limit por usuário nas chamadas de AI
- [ ] Outputs da AI sanitizados antes de renderizar como HTML
- [ ] Jailbreak e prompt injection consideradas

## Secrets e Ambiente

- [ ] Nenhum secret hardcoded no código-fonte
- [ ] Todas as chaves via `process.env`
- [ ] `.env` e `.env.local` no `.gitignore`
- [ ] `.env.example` existe sem valores reais
- [ ] Segredos diferentes entre dev e produção

## XSS e Injection

- [ ] `dangerouslySetInnerHTML` só com sanitização (DOMPurify)
- [ ] Queries SQL via Prisma/ORM (nunca string interpolation)
- [ ] Nenhum `eval()` com dados de usuário
- [ ] Headers de segurança configurados em `next.config.ts`

## Upload de Arquivos (se aplicável)

- [ ] Tipo de arquivo validado no servidor (não só no cliente)
- [ ] Tamanho máximo de arquivo validado
- [ ] Arquivos salvos fora do diretório público
- [ ] Nomes de arquivos sanitizados (sem path traversal)

## Dados Sensíveis

- [ ] Senhas hasheadas com bcrypt/argon2
- [ ] Tokens de reset com expiração curta (< 1 hora)
- [ ] `select` em Prisma sempre especifica campos (sem *)
- [ ] Logs não contêm senhas, tokens, CPF/CNPJ
- [ ] Dados sensíveis não em query params (usar POST body)

---

## Score Rápido

| Área | Itens | OK |
|------|-------|-----|
| Autenticação | 6 | /6 |
| Autorização | 4 | /4 |
| Validação | 5 | /5 |
| AI | 6 | /6 |
| Secrets | 5 | /5 |
| XSS/Injection | 5 | /5 |
| Upload | 4 | /4 |
| Dados Sensíveis | 5 | /5 |
| **Total** | **40** | **/40** |

**< 36 (90%):** Revisar antes do push  
**< 32 (80%):** NÃO fazer push
