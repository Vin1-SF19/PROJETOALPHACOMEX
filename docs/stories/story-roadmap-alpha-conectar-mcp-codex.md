# Story: Roadmap Alpha — Conectar `roadmap-status` ao Codex

## Status

Draft

## Executor Assignment

- executor: `@devops`
- quality_gate: `@architect`
- quality_gate_tools: `["build", "mcp-handshake", "tools-list", "read-only-smoke", "git-diff", "secret-scan"]`

## Story

**Como** operador do PainelAlpha no Codex Desktop/CLI,
**quero** conectar o servidor MCP local `roadmap-status` ao Codex por configuração oficial restrita ao projeto,
**para que** Codex e Claude consultem o mesmo Roadmap Alpha sem alterar nem interromper a integração já funcional do Claude.

## Contexto e valor

O servidor STDIO já existe em `mcp/roadmap-status`, compila para `dist/index.js` e expõe nove ferramentas. O Claude já o registra pelo `.mcp.json`. A pendência é dar ao Codex uma identidade própria: uma `RoadmapApiKey` dedicada, criada pelo CRUD unitário já suportado, e a camada de configuração project-scoped do Codex. Há criação de um único registro operacional no modelo existente, mas nenhuma mudança de schema, migration, aplicação ou contrato HTTP.

## Decisões autônomas

- `[AUTO-DECISION] Qual configuração usar? → Criar .codex/config.toml com [mcp_servers.roadmap-status]. (reason: é o mecanismo project-scoped oficial compartilhado por Codex Desktop, CLI e extensão em projetos confiáveis)`
- `[AUTO-DECISION] Qual identidade usar? → Gerar uma RoadmapApiKey exclusiva para Codex, distinta da credencial do Claude, com label identificável e scopes roadmap:read/roadmap:write. (reason: auditoria, revogação e rate limit precisam separar os dois clientes)`
- `[AUTO-DECISION] Como fornecer credenciais sem gravá-las na configuração versionável? → Salvar ROADMAP_MCP_BASE_URL e ROADMAP_MCP_TOKEN como variáveis de ambiente de usuário no host e encaminhá-las pelo env_vars do Codex. (reason: o segredo não entra no TOML, Git ou arquivo .env e permanece disponível após reiniciar Desktop/CLI)`
- `[AUTO-DECISION] A criação da key exige Vault? → Não; usar o CRUD unitário do modelo RoadmapApiKey já existente, persistindo somente SHA-256/prefixo e metadados. (reason: é operação CRUD normal, sem schema, migration, seed/backfill ou mutação em massa)`
- `[AUTO-DECISION] Como provar que Claude foi preservado? → Comparar hash SHA-256 e diff do .mcp.json antes/depois. (reason: valida preservação byte a byte, não apenas equivalência semântica)`
- `[AUTO-DECISION] accumulated-context.md → O arquivo não existe no workspace; a coerência foi derivada do README, código do MCP, .mcp.json lido sem edição e story anterior do Roadmap. (reason: não criar artefato adicional fora do escopo)`

## Critérios de aceitação

1. Uma nova `RoadmapApiKey` dedicada ao Codex é criada por operação CRUD unitária no modelo existente, com label que identifique `Codex Desktop/CLI`, scopes `roadmap:read` e `roadmap:write`, usuário criador válido e credencial distinta da usada pelo Claude; não há schema, migration, seed/backfill, mutação em massa nem acionamento do Vault.
2. O token da key Codex é exibido somente no instante da geração; o banco persiste apenas `keyHash` SHA-256, `prefix` e metadados, e a consulta posterior não permite recuperar o segredo em claro.
3. `ROADMAP_MCP_BASE_URL` e o token dedicado são salvos como variáveis de ambiente de **usuário** no host do Codex. Nenhum valor real aparece no TOML, Git, story, `.env`, logs, screenshots ou histórico de shell compartilhado; após defini-las, Codex Desktop/CLI é reiniciado para herdar o ambiente.
4. Existe `.codex/config.toml` project-scoped válido, carregável em projeto confiável, com `[mcp_servers.roadmap-status]`, `command = "node"`, `args = ["mcp/roadmap-status/dist/index.js"]` e `env_vars = ["ROADMAP_MCP_BASE_URL", "ROADMAP_MCP_TOKEN"]`; nenhuma configuração global em `~/.codex/` é necessária.
5. `npm --prefix mcp/roadmap-status run build` conclui com sucesso, sem alteração do código-fonte do servidor.
6. Após reiniciar/recarregar o Codex no projeto, o servidor conclui o handshake MCP (`initialize`/`initialized`) por STDIO e aparece conectado no Codex Desktop/CLI (`/mcp` ou `codex mcp list`), sem saída não-MCP em `stdout`.
7. Uma chamada MCP `tools/list` retorna exatamente estas nove tools: `roadmap_listar_fila`, `roadmap_ver_fase`, `roadmap_marcar_fase_iniciada`, `roadmap_marcar_fase_concluida`, `roadmap_marcar_fase_falhou`, `roadmap_perguntar`, `roadmap_registrar_nota`, `roadmap_ver_historico` e `roadmap_criar_run`.
8. Uma chamada real, via Codex, à tool read-only `roadmap_listar_fila` chega ao endpoint configurado `/api/roadmap/production/queue`, retorna dados válidos da fila e atualiza uso/rate limit da key dedicada ao Codex; o teste não cria run, evento ou transição de status.
9. O `.mcp.json` do Claude permanece byte a byte inalterado, comprovado pelo mesmo hash SHA-256 antes e depois, e o servidor do Claude continua registrado com sua identidade anterior; nenhuma key, variável, nome ou comando do Claude é removido, reutilizado ou sobrescrito.
10. O diff final não contém token, credencial, `.env`, alteração em `prisma/schema.prisma`, migration, código da aplicação ou mudança fora de `.codex/config.toml` e da atualização documental desta story; a única mutação de dados é a criação unitária da key Codex.

## Fora do escopo

- Criar outro servidor MCP ou duplicar as nove tools.
- Alterar, reutilizar, rotacionar ou revogar a key do Claude; alterar `.mcp.json`, a configuração global do Codex ou o código do Claude.
- Armazenar o token Codex em `.codex/config.toml`, `.env`, arquivo versionado ou banco em claro.
- Alterar endpoints, autenticação, UI, modelo Prisma ou migrations; criar mais de um registro ou executar mutação em massa.
- Executar qualquer tool mutável durante o smoke test.

## Tarefas / Subtarefas

- [ ] **Task 1 — Criar a identidade dedicada do Codex** (AC: 1–3, 9)
  - [ ] Registrar o hash inicial de `.mcp.json` sem imprimir seu conteúdo.
  - [ ] Gerar um token com o helper existente, persistir por CRUD unitário uma `RoadmapApiKey` Codex com somente hash SHA-256/prefixo/metadados e comprovar que ela é distinta da key Claude.
  - [ ] Definir `ROADMAP_MCP_BASE_URL` e `ROADMAP_MCP_TOKEN` no escopo de usuário sem ecoar o token; descartar a cópia em claro após a gravação e validação.
- [ ] **Task 2 — Registrar o MCP no Codex** (AC: 3–5)
  - [ ] Criar `.codex/config.toml` com `[mcp_servers.roadmap-status]`, `command = "node"`, `args = ["mcp/roadmap-status/dist/index.js"]` e `env_vars` para as duas variáveis.
  - [ ] Confirmar que nenhum valor de segredo foi incluído e executar o build do servidor existente.
- [ ] **Task 3 — Validar a conexão ponta a ponta** (AC: 6–8)
  - [ ] Recarregar o projeto confiável no Codex e comprovar handshake/conexão.
  - [ ] Executar `tools/list` e comparar os nove nomes, sem faltas ou extras.
  - [ ] Invocar somente `roadmap_listar_fila` e registrar evidência sanitizada da resposta e do uso da identidade Codex.
- [ ] **Task 4 — Provar não regressão e escopo** (AC: 9–10)
  - [ ] Comparar o hash final de `.mcp.json` com o inicial e confirmar ausência de diff no arquivo.
  - [ ] Revisar `git diff`/`git status` e executar varredura de segredos apenas nos arquivos da implementação.

## Dev Notes

- O Codex aceita MCP STDIO com `command`, `args`, `env`/`env_vars` e `cwd`; `env_vars` encaminha variáveis do ambiente local. `.codex/config.toml` é a camada oficial project-scoped e só é carregada em projeto confiável. Desktop, CLI e extensão compartilham essa configuração no mesmo host. [Source: OpenAI Docs — https://developers.openai.com/codex/mcp/#connect-codex-to-an-mcp-server]
- O servidor existente usa `StdioServerTransport`, registra `roadmapTools` e não precisa ser reimplementado. [Source: `mcp/roadmap-status/src/index.ts`]
- As nove tools e a leitura de fila estão definidas em `roadmapTools`; `roadmap_listar_fila` chama `GET /queue` com filtros opcionais. [Source: `mcp/roadmap-status/src/tools.ts`; `mcp/roadmap-status/src/client.ts`]
- O modelo `RoadmapApiKey` já existe com `keyHash`, `prefix`, scopes, revogação, expiração e rate limit; a autenticação já fornece `createRoadmapApiToken()` e `hashRoadmapApiSecret()` com SHA-256. Reutilizar esse contrato sem editar schema ou auth. [Source: `prisma/schema.prisma#RoadmapApiKey`; `src/lib/roadmap-production-api/auth.ts`]
- Criar uma única linha por CRUD normal não é mudança estrutural nem mutação em massa e, portanto, não aciona Vault; qualquer necessidade descoberta de schema/migration interrompe a execução e sai desta story. [Source: `AGENTS.md#database-safety-and-backup-policy-non-negotiable`]
- `.mcp.json` é a integração existente do Claude e também está ignorado; trate seu conteúdo como segredo e não o reproduza em saída. [Source: `.gitignore`; `.mcp.json`]

### Testing

- Build: `npm --prefix mcp/roadmap-status run build`.
- Integração MCP: handshake, `tools/list` com cardinalidade 9 e smoke real de `roadmap_listar_fila`.
- Identidade: key dedicada com hash/prefixo persistidos, token não recuperável e `lastUsedAt`/rate limit atribuídos ao Codex após o smoke.
- Não regressão: SHA-256 de `.mcp.json`, diff restrito e secret scan sem valores de `ROADMAP_MCP_TOKEN`.
- Se o Codex não carregar o TOML, confirmar primeiro que o projeto está marcado como confiável e reiniciar o cliente antes de alterar o servidor.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type:** Deployment / Configuration
- **Secondary Type:** Integration e Security
- **Complexity:** Low

### Specialized Agent Assignment

- **Primary Agents:** `@devops` (configuração e smoke), `@dev` (pre-commit obrigatório).
- **Supporting Agent:** `@architect` (gate de integração e segredos).

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): revisar TOML, escopo do diff e ausência de segredo.
- [ ] Pre-PR (`@devops`): repetir build, handshake, tools/list, leitura real e hash do Claude.
- Pre-Deployment: N/A — integração local project-scoped, sem deploy.

### Self-Healing Configuration

- Primary agent: `@dev`, modo light; máximo 2 iterações/15 minutos, somente CRITICAL em auto-fix.
- CRITICAL: auto-fix; HIGH: documentar; MEDIUM/LOW: não corrigir automaticamente.

### CodeRabbit Focus Areas

- Segredos hardcoded ou impressos em logs.
- Reutilização indevida da identidade Claude, persistência de token em claro ou alteração acidental de `.mcp.json`/configuração global.
- Caminhos/quoting compatíveis com Windows e inicialização STDIO limpa.
- Smoke test limitado à tool read-only.

## Initial File List

### Criar

- `.codex/config.toml`

### Estado operacional (sem arquivo versionado)

- Uma linha `RoadmapApiKey` dedicada ao Codex, criada por CRUD unitário no modelo existente.
- Variáveis de ambiente de usuário `ROADMAP_MCP_BASE_URL` e `ROADMAP_MCP_TOKEN` no host do Codex.

### Modificar

- Nenhum arquivo de aplicação, Claude, banco ou servidor MCP.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-26 | 0.1.0 | Draft mínimo para conectar o MCP existente ao Codex sem regressão no Claude. | River (`@sm`) |
| 2026-08-26 | 0.2.0 | Blueprint Scout incorporado: identidade Codex dedicada, hash no banco, segredo em ambiente de usuário e `env_vars`. | River (`@sm`) |

## Dev Agent Record

### Agent Model Used

_A preencher pelo executor._

### Debug Log References

_A preencher pelo executor._

### Completion Notes

_A preencher pelo executor._

### File List

_A substituir pela lista real antes da revisão._

## QA Results

_A preencher pelo agente de QA._
