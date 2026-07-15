# AGENTS.md - Synkra AIOX (Codex CLI)

Este arquivo define as instrucoes do projeto para o Codex CLI.

<!-- AIOX-MANAGED-START: core -->
## Core Rules

1. Siga a Constitution em `.aiox-core/constitution.md`
2. Priorize `CLI First -> Observability Second -> UI Third`
3. Trabalhe por stories em `docs/stories/`
4. Nao invente requisitos fora dos artefatos existentes
<!-- AIOX-MANAGED-END: core -->

<!-- AIOX-MANAGED-START: quality -->
## Quality Gates

- Rode `npm run lint`
- Rode `npm run typecheck`
- Rode `npm test`
- Atualize checklist e file list da story antes de concluir
<!-- AIOX-MANAGED-END: quality -->

## Database Safety and Backup Policy (NON-NEGOTIABLE)

- Acione o agente `Vault` antes de qualquer alteracao de estrutura ou migracao de banco: tabelas, colunas, indices, chaves, relacionamentos, constraints, tipos, seeds/backfills e operacoes em massa.
- Antes de executar, apresente ao usuario, em linguagem clara e detalhada: ambiente e banco afetados, comandos/steps planejados, impacto, riscos de perda ou indisponibilidade, alternativa nao destrutiva e plano de rollback.
- Sempre solicite confirmacao explicita do usuario antes da alteracao. Silencio, contexto anterior ou aprovacao generica nao contam como consentimento.
- Exija backup completo, verificado e criado antes da alteracao. O backup deve ter no maximo 48 horas; se estiver vencido, vazio, corrompido ou sem evidencia verificavel, bloqueie e gere um novo.
- Use `database-backups/pre-change/` para backups ligados a mudancas e `database-backups/daily/` para backups automaticos. Nunca versione dumps, tokens ou dados reais no Git.
- O backup diario deve rodar as 02:00 no horario local do projeto (`America/Sao_Paulo`). Remova apenas backups diarios com mais de 7 dias, e somente depois de um novo backup ser criado e validado com sucesso. Backups `pre-change` nao entram nessa limpeza automatica.
- Uma rotina CRUD normal do aplicativo nao exige backup por operacao; esta regra cobre mudancas de estrutura/migracao e mutacoes em massa ou de risco elevado.
- Nenhuma migration ou alteracao de banco e executada sem o relatorio `Vault`, evidencia do backup e confirmacao do usuario.

<!-- AIOX-MANAGED-START: codebase -->
## Project Map

- Core framework: `.aiox-core/`
- CLI entrypoints: `bin/`
- Shared packages: `packages/`
- Tests: `tests/`
- Docs: `docs/`
<!-- AIOX-MANAGED-END: codebase -->

<!-- AIOX-MANAGED-START: commands -->
## Common Commands

- `npm run sync:ide`
- `npm run sync:ide:check`
- `npm run sync:skills:codex`
- `npm run sync:skills:codex:global` (opcional; neste repo o padrao e local-first)
- `npm run validate:structure`
- `npm run validate:agents`
<!-- AIOX-MANAGED-END: commands -->

<!-- AIOX-MANAGED-START: shortcuts -->
## Agent Shortcuts

Preferencia de ativacao no Codex CLI:
1. Use `/skills` e selecione `aiox-<agent-id>` vindo de `.codex/skills` (ex.: `aiox-architect`)
2. Se preferir, use os atalhos abaixo (`@architect`, `/architect`, etc.)

Interprete os atalhos abaixo carregando o arquivo correspondente em `.aiox-core/development/agents/` (fallback: `.codex/agents/`), renderize o greeting via `generate-greeting.js` e assuma a persona ate `*exit`:

- `@architect`, `/architect`, `/architect.md` -> `.aiox-core/development/agents/architect.md`
- `@dev`, `/dev`, `/dev.md` -> `.aiox-core/development/agents/dev.md`
- `@qa`, `/qa`, `/qa.md` -> `.aiox-core/development/agents/qa.md`
- `@pm`, `/pm`, `/pm.md` -> `.aiox-core/development/agents/pm.md`
- `@po`, `/po`, `/po.md` -> `.aiox-core/development/agents/po.md`
- `@sm`, `/sm`, `/sm.md` -> `.aiox-core/development/agents/sm.md`
- `@analyst`, `/analyst`, `/analyst.md` -> `.aiox-core/development/agents/analyst.md`
- `@devops`, `/devops`, `/devops.md` -> `.aiox-core/development/agents/devops.md`
- `@data-engineer`, `/data-engineer`, `/data-engineer.md` -> `.aiox-core/development/agents/data-engineer.md`
- `@ux-design-expert`, `/ux-design-expert`, `/ux-design-expert.md` -> `.aiox-core/development/agents/ux-design-expert.md`
- `@squad-creator`, `/squad-creator`, `/squad-creator.md` -> `.aiox-core/development/agents/squad-creator.md`
- `@aiox-master`, `/aiox-master`, `/aiox-master.md` -> `.aiox-core/development/agents/aiox-master.md`
<!-- AIOX-MANAGED-END: shortcuts -->
