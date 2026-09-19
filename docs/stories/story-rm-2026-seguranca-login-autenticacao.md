# Story RM-2026 — Hardening de login e recuperação de acesso

## Status

InProgress

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["vitest", "eslint", "tsc", "next-build", "security-regression"]

## Story

**Como** responsável pelo Painel Alpha,
**quero** que autenticação, recuperação e troca de senha resistam a abuso e revoguem credenciais antigas,
**para que** uma conta não seja tomada por força bruta, enumeração, escalada de privilégio ou reutilização de sessão.

## Contexto e origem

Esta story deriva do diagnóstico de segurança solicitado em 2026-09-19 e dos seis achados confirmados no fluxo atual. O recorte cobre somente controles de autenticação e autorização já exigidos pelos achados; MFA/passkeys e alertas de novo dispositivo dependem de decisão de produto separada e não são requisito desta correção.

## Acceptance Criteria

1. [ ] Toda Server Action que altera usuário, função, status ou permissões exige sessão administrativa no servidor, valida IDs e payloads e não usa defaults que elevem privilégio.
2. [ ] Login aplica limite compartilhado entre instâncias por endereço de origem e por identificador normalizado, sem revelar se o usuário existe, com janela/bloqueio testáveis e resposta genérica.
3. [ ] A verificação de senha não cria caminho rápido observável para e-mail inexistente e não bloqueia o event loop com comparação síncrona.
4. [ ] Recuperação de senha está conectada à interface, normaliza e valida o e-mail, usa resposta indistinguível para conta existente/inexistente, aplica limite compartilhado e não expõe tokens em banco em texto puro.
5. [ ] Tokens de recuperação são aleatórios, armazenados somente como hash, têm validade máxima de uma hora, são de uso único e o link usa origem configurada e rota real da aplicação.
6. [ ] Todas as entradas de senha aplicam a mesma política no servidor e apresentam orientação equivalente no cliente.
7. [ ] A troca obrigatória só é aceita para usuário ativo que ainda esteja marcado com senha temporária; a troca normal continua exigindo a senha atual.
8. [ ] Alterar ou redefinir senha incrementa a versão de sessão; JWTs emitidos antes da alteração deixam de autorizar o painel na revalidação seguinte.
9. [ ] O cookie de sessão de produção mantém o prefixo seguro provido pelo Auth.js, com `HttpOnly`, `Secure` e `SameSite=Lax`.
10. [ ] O limite global de Server Actions é reduzido a um valor compatível com formulários do sistema; uploads grandes usam seus endpoints próprios.
11. [ ] Respostas da aplicação incluem headers defensivos compatíveis com o sistema (`nosniff`, frame ancestors/frame options, referrer e permissions policy) sem quebrar integrações existentes.
12. [ ] Testes automatizados cobrem bypass de autorização, limites de abuso, enumeração, política de senha, token hash/uso único, troca obrigatória e revogação de sessão.
13. [ ] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados; qualquer baseline externo ao recorte é separado de regressões introduzidas por esta story.

## Tasks / Subtasks

- [x] Corrigir autorização e validação das actions administrativas de usuários/colaboradores.
- [x] Criar primitivas compartilhadas de normalização, política de senha e resposta segura.
- [x] Implementar rate limit persistente de login e recuperação, com expiração/limpeza limitada.
- [x] Corrigir autenticação para comparação assíncrona e caminho uniforme de credencial inválida.
- [x] Corrigir recuperação de senha ponta a ponta e armazenamento hash do token.
- [x] Restringir troca obrigatória ao estado de primeiro acesso e revogar sessões após alterações de senha.
- [x] Corrigir configuração de cookie, limite de body e headers defensivos.
- [x] Criar migration aditiva após protocolo Vault, backup verificado e aprovação explícita.
- [x] Adicionar testes de segurança e regressão.
- [x] Executar gates e registrar evidências.

## Dev Notes

- Pontos atuais confirmados: `auth.ts`, `src/lib/loginAction.ts`, `src/lib/user.ts`, `src/lib/auth/acesso-painel.ts`, `src/lib/auth-guard.ts`, `src/actions/manage-user.ts`, `src/actions/colaboradores.ts`, `src/actions/onboarding.ts`, `src/actions/perfil.ts`, `src/actions/RecuperarSenha.ts`, `src/components/RecuperarSenha/page.tsx`, `src/app/auth/RedefinirSenha/page.tsx` e `next.config.ts`.
- O runtime é Next.js 16 + Auth.js v5 beta + Prisma/SQLite sobre Turso remoto. Server Actions podem executar em múltiplas instâncias; um `Map` em memória não satisfaz o rate limit de produção.
- O schema Prisma possui alterações locais não relacionadas de inventário. A migration desta story deve ser isolada e aditiva, sem reverter ou incorporar esse trabalho.
- O banco é produção remota. Nenhuma alteração estrutural pode ser aplicada antes do relatório Vault, backup completo validado com até 48 horas e confirmação explícita específica do usuário.
- O login e a recuperação devem continuar respondendo de forma genérica. Logs e testes não podem conter senha, token bruto ou segredo.
- Uploads grandes já possuem rotas dedicadas; o limite de Server Actions não deve ser usado como substituto do contrato de upload.

## Vault

**Estado:** APPLIED — migration aditiva aplicada após aprovação explícita.
**Ambiente:** Turso remoto de produção configurado em `.env.local`.
**Mudanças executadas:** versão inteira de sessão em `usuarios`, tabela persistente mínima para limites de abuso e índice de limpeza. Sem `DROP`, rename, backfill destrutivo ou exclusão em massa.
**Backup:** dump pré-mudança validado com SHA-256 `d8ebaa7d2b382cedb8f24c08005d4d8003d1c1e757eeab5d9003b4e56580309d`.
**Validação:** schema e índice presentes, zero violações de foreign key e smoke do rate limit aprovado com remoção dos dados de teste.

## Testing

- Unitários: normalização, política de senha, geração/hash/validação de token, cálculo das janelas e headers.
- Integração de actions: admin versus usuário comum, senha temporária, recuperação existente/inexistente e revogação por versão.
- Abuso: limite por IP e por identificador, sucesso não apaga proteção de IP, expiração libera nova tentativa e mensagens permanecem genéricas.
- Regressão: suíte auth atual, rota canônica de login, sessão ativa e uploads fora de Server Actions.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type**: Security
**Secondary Type(s)**: Database, API, Frontend, Configuration
**Complexity**: Alta

### Specialized Agent Assignment

**Primary Agents**:
- @dev
- @architect

**Supporting Agents**:
- @db-sage / Vault para o checkpoint de banco
- @qa para regressão e validação final

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): revisar autenticação, autorização, validação e segredos.
- [ ] Pre-PR (@github-devops): revisar compatibilidade e migration isolada.
- [ ] Pre-Deployment (@github-devops): confirmar backup, variáveis, headers e rollback.

### Self-Healing Configuration

**Expected Self-Healing**:
- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutes
- Severity Filter: CRITICAL

**Predicted Behavior**:
- CRITICAL issues: corrigir automaticamente e repetir gates.
- HIGH issues: documentar e bloquear conclusão até decisão explícita.

### CodeRabbit Focus Areas

**Primary Focus**:
- OWASP Authentication Failures e Broken Access Control.
- Concorrência/atomicidade do rate limit e revogação de JWT.

**Secondary Focus**:
- Timing attacks, enumeração e proteção de tokens.
- Compatibilidade de headers, cookies e Server Actions.

## Change Log

- 2026-09-19: story criada a partir do diagnóstico confirmado; implementação iniciada, migration aguardando Vault.
- 2026-09-19: backup pré-mudança validado, migration aditiva aplicada no Turso de produção e controles de autenticação implementados.
- 2026-09-19: suíte de segurança, lint direcionado e build aprovados; gates globais registraram somente falhas preexistentes fora do recorte.

## File List

- `docs/stories/story-rm-2026-seguranca-login-autenticacao.md`
- `auth.ts`
- `middleware.ts`
- `next.config.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260919141000_auth_login_security/migration.sql`
- `src/actions/ColaboradorRH.ts`
- `src/actions/CreateAction.ts`
- `src/actions/RecuperarSenha.ts`
- `src/actions/colaboradores.ts`
- `src/actions/gestaoSetores.ts`
- `src/actions/manage-user.ts`
- `src/actions/onboarding.ts`
- `src/actions/perfil.ts`
- `src/actions/updateUser.ts`
- `src/app/PainelAlpha/InfosPerfil/Perfil/FormularioSenha/FormSenha.tsx`
- `src/app/PainelAlpha/mudar-senha/page.tsx`
- `src/app/auth/RedefinirSenha/page.tsx`
- `src/components/Colaboradores/ModalPerfilColaborador.tsx`
- `src/components/FormCadastro.tsx`
- `src/components/RecuperarSenha/page.tsx`
- `src/components/mudar-senha/MudarSenhaForm.tsx`
- `src/lib/auth/acesso-painel.ts`
- `src/lib/auth/password-policy.ts`
- `src/lib/auth/rate-limit.ts`
- `src/lib/auth/recovery-token.ts`
- `src/lib/user.ts`
- `src/types/next-auth.d.ts`
- `tests/auth/acesso-painel.test.ts`
- `tests/auth/admin-user-actions.test.ts`
- `tests/auth/credenciais-status.test.ts`
- `tests/auth/login-rate-limit-wiring.test.ts`
- `tests/auth/mandatory-password-change.test.ts`
- `tests/auth/middleware-security.test.ts`
- `tests/auth/password-policy.test.ts`
- `tests/auth/password-recovery.test.ts`
- `tests/auth/rate-limit.test.ts`
- `tests/auth/security-headers.test.ts`

## Dev Agent Record

### Completion Notes

- Migration aplicada no Turso de produção com três statements exclusivamente aditivos: versão de sessão, tabela de rate limit e índice de limpeza.
- Backup pré-mudança verificado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-19T13-56-45-911Z.sql`, 131.989.973 bytes, 329 tabelas, 130.199 linhas, SHA-256 `d8ebaa7d2b382cedb8f24c08005d4d8003d1c1e757eeab5d9003b4e56580309d`.
- Pós-migration validado: coluna/tabela/índice presentes, zero violações de foreign key e smoke real do bloqueio 5/6 aprovado; dados de smoke removidos.
- Login e recuperação agora têm limite persistente por origem e identificador com chaves HMAC, mensagens genéricas e limpeza limitada.
- Senhas usam política única de 12–128 caracteres e bcrypt assíncrono com custo 12 nos fluxos de criação, troca, reset e administração.
- Tokens de recuperação são aleatórios, persistidos somente como SHA-256, expiram em uma hora e são consumidos atomicamente uma única vez.
- Alterações de senha, função, status e permissões incrementam `authSessionVersion`; JWT antigo é bloqueado na próxima revalidação.
- Cookie Auth.js seguro restaurado, troca temporária imposta no middleware, limite de Server Actions reduzido para 30 MB e headers defensivos adicionados.
- Verificações aprovadas: `npx prisma validate`, `npx prisma generate`, lint direcionado, `npx vitest run tests/auth --coverage=false` (19 arquivos/128 testes), `npm run build` e `git diff --check`.
- Gates globais executados, com baseline externo ao recorte: lint 3.642 ocorrências; typecheck em rotas/arquivos legados; testes 3.451 aprovados, 20 falhos em Alpha SEO, apresentações, BPM, documentos, Onyx e parceiros. Nenhum erro apontou arquivo de segurança alterado.
- CodeRabbit CLI não está instalado neste ambiente. A story permanece `InProgress` até saneamento/aceite formal do baseline global e revisão QA.
