# Story: Usar token individual do Onyx em agentes e ferramentas

**ID:** STORY-ONYX-TOKEN-INDIVIDUAL-AGENTES-FERRAMENTAS  
**Modulo:** IAlpha / Integracao Onyx  
**Status:** Ready for Review  
**Prioridade:** Alta  
**Tipo:** Integracao / Seguranca  
**Data de criacao:** 2026-08-03

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

**Como** usuario do Painel Alpha com uma conta propria no Onyx,  
**quero** que as operacoes de agentes e ferramentas usem o `token_onyx` configurado no meu cadastro,  
**para** que cada usuario acesse o Onyx com sua propria identidade e nao dependa do token global do servidor.

## Acceptance Criteria

- [ ] **AC-001 — Listagem individual de agentes:** `GET /api/onyx/agents` resolve o token pelo `session.user.id` e o envia ao Onyx ao listar personas.
- [ ] **AC-002 — Listagem individual de ferramentas:** `GET /api/onyx/tools` resolve o token pelo `session.user.id` e o envia ao Onyx ao listar tools.
- [ ] **AC-003 — Detalhe individual do agente:** `GET /api/onyx/agents/[id]` usa o token do usuario autenticado.
- [ ] **AC-004 — Consultas auxiliares consistentes:** consultas de ferramentas feitas durante criacao, edicao ou geracao de avatar recebem o mesmo token individual da operacao principal.
- [ ] **AC-005 — Compatibilidade:** chamadas tecnicas sem token individual continuam podendo usar o `ONYX_API_KEY` conforme o comportamento existente; conectores administrativos e rotinas de servico ficam fora do escopo.
- [ ] **AC-006 — Seguranca:** o token nunca e enviado ao navegador, aceito do corpo da requisicao ou registrado em logs.
- [ ] **AC-007 — Sem mudanca de banco:** a entrega reutiliza `usuarios.token_onyx` e nao cria migration, tabela, coluna, indice, seed ou backfill.
- [ ] **AC-008 — Testes:** testes automatizados comprovam que o header `Authorization` das operacoes cobertas usa o token individual e preserva o fallback tecnico existente.

## Fora do Escopo

- Alterar o formulario de criacao ou edicao de usuarios, que ja persiste `token_onyx`.
- Alterar schema, dados existentes ou executar operacoes em massa no banco.
- Modificar conectores administrativos, configuracoes globais de modelos ou rotinas de servico do Onyx.
- Expor o PAT individual ao cliente.

## Tasks / Subtasks

- [x] **Task 1 — Propagar o token nas funcoes de leitura do client Onyx** (AC: 1, 2, 3, 5, 6)
  - [x] Permitir que `listAgents`, `getAgent` e `listTools` recebam `userToken` opcional.
  - [x] Preservar o fallback atual para `ONYX_API_KEY` quando essas funcoes forem usadas sem token.

- [x] **Task 2 — Resolver o token nas rotas autenticadas** (AC: 1, 2, 3, 6)
  - [x] Buscar o token exclusivamente pelo identificador da sessao.
  - [x] Passar o token para as chamadas do client sem inclui-lo na resposta ou nos logs.

- [x] **Task 3 — Propagar o token nas consultas auxiliares** (AC: 4, 5, 6)
  - [x] Ajustar `getImageGenToolId` e os chamadores em criacao, edicao e geracao de avatar.
  - [x] Manter rotinas globais fora do escopo inalteradas.

- [x] **Task 4 — Testes e regressao** (AC: 1–8)
  - [x] Cobrir o uso do token individual nas leituras de personas e tools.
  - [x] Cobrir que chamadas sem token continuam usando o PAT de servico.
  - [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Dev Notes

### Contexto tecnico verificado

- `usuarios.token_onyx` ja existe e e preenchido na criacao/edicao do usuario. [Source: `prisma/schema.prisma`; `src/actions/CreateAction.ts`; `src/actions/ColaboradorRH.ts`]
- `getUserOnyxToken` resolve a credencial a partir do id confiavel da sessao; o token nao vem do cliente. [Source: `src/lib/onyx/user-token.ts`]
- `authHeaders` usa o token individual quando recebido e recorre a `ONYX_API_KEY` quando ele nao e informado. [Source: `src/lib/onyx/client.ts`]
- As rotas de listagem de agentes e ferramentas chamam atualmente funcoes sem suporte ao argumento `userToken`, causando o uso do PAT global. [Source: `src/app/api/onyx/agents/route.ts`; `src/app/api/onyx/tools/route.ts`; `src/lib/onyx/client.ts`]
- Os documentos de arquitetura configurados nao estao presentes neste checkout; o contexto foi extraido do requisito confirmado pelo usuario, das decisoes registradas e do fluxo de codigo existente. [Source: `.aiox-core/core-config.yaml`; `.bibble/memory/decisions.md`]

### Pontos de integracao

- `src/lib/onyx/client.ts`
- `src/lib/onyx/user-token.ts`
- `src/app/api/onyx/agents/route.ts`
- `src/app/api/onyx/agents/[id]/route.ts`
- `src/app/api/onyx/tools/route.ts`
- `src/app/api/onyx/agents/generate-avatar/route.ts`
- Testes Onyx em `tests/onyx/`

### Restricoes

- Nenhuma alteracao de banco e autorizada ou necessaria.
- Nunca registrar, serializar ou devolver o valor de `token_onyx`.
- O token deve ser derivado somente de `session.user.id`.
- Preservar o uso deliberado do PAT de servico nas rotinas fora do escopo.

## Testing

| Cenario | Resultado esperado |
|---|---|
| Listar agentes com token individual | Onyx recebe `Authorization: Bearer <token individual>` |
| Listar ferramentas com token individual | Onyx recebe `Authorization: Bearer <token individual>` |
| Consultar detalhe do agente | Onyx recebe o token do usuario da sessao |
| Consulta auxiliar de tool durante operacao de agente | Usa o mesmo token da operacao principal |
| Chamada tecnica sem token | Mantem o fallback para `ONYX_API_KEY` |
| Resposta ou log da rota | Nao contem o PAT |

## CodeRabbit Integration

**Story Type Analysis**

- **Primary Type:** Integration
- **Secondary Type(s):** API, Security
- **Complexity:** Medium

**Specialized Agent Assignment**

- **Primary:** `@dev`
- **Quality Gate:** `@architect`
- **Supporting:** `@qa`, `@github-devops` no Pre-PR

**Quality Gate Tasks**

- [x] Pre-Commit (`@dev`): revisao manual concluida; CodeRabbit indisponivel por ausencia de WSL, conforme relatorio.
- [ ] Pre-PR (`@github-devops`): executar CodeRabbit contra a base.
- [ ] Pre-Deployment: N/A.

**Self-Healing Configuration**

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: `auto_fix`
- HIGH: `document_only`

**Focus Areas**

- Identidade da sessao como origem da credencial.
- Ausencia de vazamento de PAT.
- Propagacao consistente do token nas chamadas encadeadas.
- Compatibilidade das rotinas tecnicas fora do escopo.

## Change Log

| Data | Versao | Descricao | Autor |
|---|---:|---|---|
| 2026-08-03 | 1.0 | Story criada e aprovada a partir do requisito confirmado pelo usuario | River (SM) |
| 2026-08-03 | 1.1 | Token individual propagado nas leituras e fluxos auxiliares; testes e build validados | Dex (Dev) |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/onyx/client-user-token.test.ts tests/onyx/routes-user-token.test.ts` — 2 arquivos, 8 testes aprovados.
- `npx vitest run --coverage --maxWorkers=1` — 77 arquivos, 626 testes aprovados.
- ESLint direcionado aos arquivos desta story — aprovado sem erros ou warnings.
- `npm run typecheck` — bloqueado por cinco erros preexistentes fora dos arquivos Onyx alterados.
- `npm run lint` — bloqueado por debitos preexistentes em `.aiox-core`, `.agents` e worktrees `.claude`; arquivos desta story passam isoladamente.
- `npm run build` — `prisma generate` bloqueado por DLL em uso (`EPERM`); `npx next build` aprovado.
- CodeRabbit — indisponivel porque o WSL nao esta instalado; revisao manual registrada em `docs/qa/coderabbit-reports/`.

### Completion Notes List

- `GET /api/onyx/agents`, `GET /api/onyx/tools` e `GET /api/onyx/agents/[id]` agora resolvem e enviam o token do usuario autenticado.
- O mesmo token e propagado para descoberta da tool de imagem, avatar do agente, download do avatar gerado e criacao de tool pelo admin autenticado.
- Chamadas tecnicas sem token continuam usando `ONYX_API_KEY`; chamadas com token individual funcionam mesmo sem PAT global.
- Nenhum token foi exposto ao navegador ou incluido em logs.
- Nenhuma alteracao de banco, migration, dependencia ou configuracao foi realizada.

### File List

- `src/lib/onyx/client.ts`
- `src/app/api/onyx/agents/route.ts`
- `src/app/api/onyx/agents/[id]/route.ts`
- `src/app/api/onyx/agents/[id]/avatar/route.ts`
- `src/app/api/onyx/agents/generate-avatar/route.ts`
- `src/app/api/onyx/tools/route.ts`
- `src/app/api/onyx/file/[fileId]/route.ts`
- `tests/onyx/client-user-token.test.ts`
- `tests/onyx/routes-user-token.test.ts`
- `plan/self-critique-onyx-token-individual.json`
- `docs/qa/coderabbit-reports/story-onyx-token-individual-agentes-ferramentas.md`
- `docs/stories/story-onyx-token-individual-agentes-ferramentas.md`

## QA Results

_Pendente._
