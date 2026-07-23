# Story: Bloquear acesso de usuários não ativos

**ID:** STORY-GESTAO-EQUIPE-BLOQUEIO-STATUS  
**Módulo:** Gestão de Equipe / Autenticação  
**Status:** Ready for Review  
**Prioridade:** Alta  
**Tipo:** Segurança / Autenticação  
**Data de criação:** 2026-07-23  

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools:
  - coderabbit
  - lint
  - typecheck
  - vitest
```

## Story

**Como** administrador que gerencia a equipe,  
**quero** que somente usuários com `usuarios.status = "ATIVO"` consigam usar o Painel Alpha,  
**para** que pessoas inativas, afastadas ou em férias percam o acesso sem depender de logout manual.

## Acceptance Criteria

- [x] **AC-001 — Regra única de acesso:** Qualquer usuário cujo valor atual de `usuarios.status` seja diferente de `ATIVO` fica sem acesso ao Painel Alpha. A regra é genérica `status !== "ATIVO"` e não depende de enumerar os demais valores possíveis, como `INATIVO`, `AFASTADO` e `FERIAS`.
- [x] **AC-002 — Novos logins:** O login por credenciais é recusado quando o usuário não existe ou seu status atual é diferente de `ATIVO`, mesmo que e-mail e senha estejam corretos.
- [x] **AC-003 — Sessões existentes:** Após o status de um usuário ser salvo como diferente de `ATIVO` na Gestão de Equipe, qualquer JWT já emitido para esse usuário deixa de autorizar acesso, no máximo na próxima requisição protegida, sem aguardar o `maxAge` do token e sem exigir logout manual.
- [x] **AC-004 — Revogação efetiva no servidor:** Possuir um JWT estruturalmente válido não basta para acessar páginas privadas, API routes ou Server Actions. O backend consulta/valida o status atual do usuário e nega a operação antes de retornar dados ou executar mutações.
- [x] **AC-005 — Sessão aberta no navegador:** Um usuário já conectado que passe a ter status diferente de `ATIVO` é retirado do fluxo autenticado automaticamente quando o cliente fizer a próxima interação/revalidação com o servidor, retornando ao login e sem permanecer operando apenas com estado local obsoleto.
- [x] **AC-006 — Usuário ativo preservado:** Usuários com `usuarios.status = "ATIVO"` continuam conseguindo autenticar e usar as áreas para as quais já possuem autorização, sem alteração das regras atuais de papel ou permissões.
- [x] **AC-007 — Usuário inexistente:** Uma sessão JWT cujo `user.id` não corresponda mais a um registro em `usuarios` é negada com o mesmo comportamento seguro de uma conta não ativa.
- [x] **AC-008 — Sem mudança de banco:** A entrega reutiliza `usuarios.status`; não cria tabela, coluna, índice, seed, backfill ou migration.

## Fora do Escopo

- Alterar os status disponíveis ou suas regras de exibição na Gestão de Equipe.
- Alterar papéis, permissões de módulo ou o prazo de 24 horas configurado para JWTs.
- Criar modelo de sessão persistente ou modificar o schema do banco.

## Tasks / Subtasks

- [x] **Task 1 — Centralizar a validação de usuário ativo no servidor** (AC: 1, 3, 4, 6, 7)
  - [x] Criar ou ajustar um guard compartilhado que receba a identidade da sessão, consulte `usuarios` pelo identificador confiável e aceite somente `status === "ATIVO"`.
  - [x] Garantir negação por padrão para sessão ausente, identificador inválido, usuário inexistente, erro de validação ou status diferente de `ATIVO`.
  - [x] Não confiar em um status gravado no JWT como fonte de verdade para essa decisão.

- [x] **Task 2 — Bloquear novos logins de usuários não ativos** (AC: 1, 2, 6)
  - [x] Aplicar a regra no fluxo de credenciais antes da emissão do JWT.
  - [x] Manter resposta de autenticação segura, sem revelar se a recusa ocorreu por senha, inexistência ou status.

- [x] **Task 3 — Revogar efetivamente JWTs já emitidos** (AC: 3, 4, 5, 7)
  - [x] Aplicar a validação atual de `usuarios.status` nos limites centrais usados por páginas privadas e chamadas autenticadas.
  - [x] Garantir que uma chamada direta a API route ou Server Action não contorne o bloqueio da interface.
  - [x] Ajustar o mecanismo de revalidação/heartbeat do cliente, se necessário, para encerrar o estado autenticado local e redirecionar automaticamente ao login após a negação do servidor.
  - [x] Confirmar que reter ou reapresentar o cookie JWT não devolve acesso enquanto `usuarios.status !== "ATIVO"`.

- [x] **Task 4 — Conectar a edição da Gestão de Equipe à regra** (AC: 1, 3, 5, 8)
  - [x] Preservar o salvamento atual de `usuarios.status` em `updateColaboradorDados`.
  - [x] Validar que, depois do sucesso da edição, a conta afetada é bloqueada na próxima requisição protegida sem ação manual dela.
  - [x] Não adicionar migration nem mutação em massa.

- [x] **Task 5 — Testes automatizados e regressão** (AC: 1–8)
  - [x] Cobrir login com `ATIVO`, `INATIVO`, `AFASTADO`, `FERIAS`/valor não ativo e usuário inexistente.
  - [x] Cobrir JWT emitido antes da alteração de status e reutilizado depois dela.
  - [x] Cobrir acesso direto a página privada, API route e guard de Server Action com status não ativo.
  - [x] Cobrir sessão com usuário removido e falha segura na consulta do status.
  - [x] Cobrir que a conta `ATIVO` mantém o comportamento existente.
  - [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

- [x] **Task 6 — Impedir login renderizado dentro de iframe após expiração da sessão** (AC: 4, 5)
  - [x] Identificar o fluxo de redirecionamento que mantém `/` dentro das abas em iframe.
  - [x] Fazer a expiração ou revogação da sessão redirecionar a janela principal para o login.
  - [x] Cobrir o comportamento com teste automatizado sem afetar páginas públicas legítimas.

## Dev Notes

### Contexto técnico verificado

- O projeto usa NextAuth v5 com estratégia JWT e `maxAge` de 24 horas. O callback atual copia dados do usuário para o token, portanto um JWT emitido pode ficar obsoleto em relação ao banco. [Source: `auth.ts`]
- O login por credenciais delega a busca para `findUserByCredentials`; a implementação atual valida e-mail e senha, mas não filtra `usuarios.status`. [Source: `auth.ts`; `src/lib/user.ts`]
- O middleware atual considera a presença do token suficiente para rotas privadas e não consulta o status atual do usuário. [Source: `middleware.ts`]
- A edição do perfil na Gestão de Equipe salva `status` por `updateColaboradorDados`, e a interface apresenta `ATIVO`, `INATIVO`, `AFASTADO` e `FÉRIAS`. A regra desta story continua deliberadamente genérica: todo valor diferente de `ATIVO` bloqueia. [Source: `src/actions/ColaboradorRH.ts`; `src/components/Colaboradores/ModalPerfilColaborador.tsx`]
- O heartbeat atual apenas registra atividade e não bloqueia usuários não ativos; ele é um ponto existente a revisar para a retirada automática de uma sessão aberta, mas não substitui a autorização server-side. [Source: `src/app/api/heartbeat/route.ts`]
- `src/lib/auth-guard.ts` hoje valida autenticação e papel de Admin, sem validar o status atual no banco. Guards existentes devem ser conectados à política central para evitar caminhos divergentes. [Source: `src/lib/auth-guard.ts`]
- O campo `usuarios.status` já existe com default `ATIVO`. Esta story não requer nem autoriza alteração de schema. [Source: `prisma/schema.prisma`, model `usuarios`]

### Pontos de integração prováveis

- `auth.ts`
- `src/lib/user.ts`
- `middleware.ts` e/ou o limite central equivalente de proteção de rotas
- `src/lib/auth-guard.ts` ou novo guard compartilhado de sessão ativa
- `src/actions/ColaboradorRH.ts`
- `src/app/api/heartbeat/route.ts` e o consumidor client correspondente, caso usados para retirada automática
- Novos testes em `tests/auth/`

### Restrições

- Revogação efetiva significa negar autorização server-side na próxima requisição protegida; apagar o cookie no cliente, isoladamente, não atende ao AC-004.
- A verificação deve usar o estado atual do banco e negar por padrão.
- Não duplicar a política status-a-status em cada módulo; manter uma regra central reutilizável.
- Nenhuma variável de ambiente nova foi identificada como necessária.
- Os diretórios configurados `docs/architecture/` e `docs/prd/`, assim como `accumulated-context.md`, não estavam disponíveis durante a preparação. A coerência foi verificada contra o fluxo atual de autenticação, a Gestão de Equipe e as stories existentes.

### [AUTO-DECISION]

- `[AUTO-DECISION] O que caracteriza revogação efetiva de um JWT stateless? → O token deixa de autorizar no servidor na próxima requisição protegida, sem esperar expiração nem logout manual. (reason: é o resultado observável pedido e não exige alteração de schema.)`
- `[AUTO-DECISION] Como tratar grafias e futuros valores de status? → Aplicar somente a condição status === "ATIVO"; qualquer outro valor é negado. (reason: preserva a regra genérica solicitada.)`
- `[AUTO-DECISION] Como identificar a story sem epic/PRD disponível? → Usar ID e arquivo descritivos no padrão atual de docs/stories. (reason: o repositório usa stories descritivas não sequenciais e o pedido veio diretamente do usuário.)`

## Testing

| Cenário | Resultado esperado |
|---|---|
| Credenciais corretas e status `ATIVO` | Login permitido |
| Credenciais corretas e status diferente de `ATIVO` | Login recusado e nenhum JWT novo emitido |
| JWT emitido enquanto `ATIVO`, seguido de edição para não ativo | Próxima requisição protegida negada |
| Cookie JWT reapresentado após bloqueio | Continua sem acesso enquanto o status não for `ATIVO` |
| Chamada direta a API/Server Action com JWT obsoleto | Negada antes de ler dados ou mutar estado |
| Registro de usuário removido com JWT ainda presente | Acesso negado |
| Falha ao consultar o status | Acesso negado por padrão |
| Usuário `ATIVO` | Sem regressão de autenticação ou permissões existentes |

## CodeRabbit Integration

**Story Type Analysis**

- **Primary Type:** Security
- **Secondary Type(s):** API, Architecture
- **Complexity:** High — autenticação transversal e revogação de sessões existentes

**Specialized Agent Assignment**

- **Primary:** `@dev`
- **Quality Gate:** `@architect`
- **Supporting:** `@qa`, `@github-devops` no Pre-PR

**Quality Gate Tasks**

- [ ] Pre-Commit (`@dev`): revisar autenticação, negação por padrão, cobertura e caminhos de bypass.
- [ ] Pre-PR (`@github-devops`): executar CodeRabbit contra a base e confirmar ausência de findings CRITICAL.
- [ ] Pre-Deployment: N/A para esta story; seguir o processo normal de release.

**Self-Healing Configuration**

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: `auto_fix`
- HIGH: `document_only`

**Focus Areas**

- Status atual do banco como fonte de verdade.
- JWT obsoleto sem capacidade de bypass.
- Negação server-side em páginas, APIs e Server Actions.
- Respostas de login sem enumeração de conta/status.
- Ausência de migration e de alteração de schema.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-07-23 | 1.0 | Story criada e validada para desenvolvimento | River (SM) |
| 2026-07-23 | 1.1 | Regra central de acesso por status, revogação de JWT e heartbeat implementados | Dex (Dev) |
| 2026-07-23 | 1.2 | Corrigido redirecionamento de sessão expirada dentro das abas em iframe | Dex (Dev) |

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- `npx vitest run tests/auth` — 3 arquivos e 24 testes aprovados.
- `npx vitest run tests/auth` — 4 arquivos e 29 testes aprovados após a correção dos iframes.
- `npm test` — 20 arquivos e 151 testes aprovados.
- ESLint focado nos arquivos novos/alterados sem débitos legados — aprovado.
- `npm run typecheck` — mantém quatro erros preexistentes fora desta implementação.
- `npm run build` — bloqueado no `prisma generate` por `EPERM` na DLL em uso; `npx next build` aprovado.
- CodeRabbit — indisponível porque o WSL não está instalado neste ambiente.

### Completion Notes List

- Somente `usuarios.status === "ATIVO"` autoriza login e revalidação de sessão.
- JWTs existentes são confrontados com o banco em cada uso do `auth()`; conta ausente, não ativa ou falha de consulta é negada.
- O wrapper público de autenticação retorna sessão nula para páginas, APIs e Server Actions quando o token foi bloqueado.
- O heartbeat responde `403` para sessão revogada e o cliente executa logout/redirecionamento automático.
- O layout privado faz uma verificação adicional e evita loop de redirecionamento durante a limpeza do cookie.
- O carregamento de `/` dentro de uma aba em iframe agora encerra a sessão na janela principal imediatamente.
- O heartbeat diferencia usuário anônimo de uma janela previamente autenticada e trata também expiração natural com `401`.
- Nenhuma mudança de schema, migration ou mutação em massa foi realizada.

### File List

- `auth.ts`
- `middleware.ts`
- `src/app/PainelAlpha/layout.tsx`
- `src/app/api/heartbeat/route.ts`
- `src/components/Colaboradores/ModalPerfilColaborador.tsx`
- `src/components/Heartbeat.tsx`
- `src/lib/auth/acesso-painel.ts`
- `src/lib/auth/navegacao-sessao.ts`
- `src/lib/user.ts`
- `src/types/next-auth.d.ts`
- `tests/auth/acesso-painel.test.ts`
- `tests/auth/credenciais-status.test.ts`
- `tests/auth/heartbeat-status.test.ts`
- `tests/auth/navegacao-sessao.test.ts`
- `docs/qa/coderabbit-reports/story-gestao-equipe-bloqueio-status.md`
- `docs/stories/story-gestao-equipe-bloqueio-usuarios-nao-ativos.md`

## QA Results
