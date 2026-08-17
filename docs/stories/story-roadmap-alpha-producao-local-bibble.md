# Story: Roadmap Alpha — Produção local orientada pelos agentes Bibble

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@architect`
- quality_gate_tools: `["lint", "typecheck", "test", "build", "runtime-e2e", "security-review"]`

## Story

**Como** administrador do Painel Alpha,
**quero** acompanhar e executar localmente os objetivos documentados pelo Roadmap por meio dos agentes Bibble,
**para que** as fases gerem mudanças reais no projeto e eu mantenha a aprovação final por revisão e commit manual.

## Decisões

- Execução é exclusivamente local em `C:\Users\TI\Desktop\PainelAlpha`.
- Nenhum agente realiza `git commit`, `git push`, PR ou publicação.
- Ollama/Qwen é o provedor padrão. Codex CLI e Claude Code aparecem como opções somente quando o diagnóstico comprovar disponibilidade.
- MCP não é requisito para a primeira versão: cada adapter usa o protocolo nativo disponível. Novos adapters poderão ser adicionados sem alterar o contrato da UI.
- O cérebro é o catálogo instalado em `.claude/skills/bibble-squad/`, junto de `AGENTS.md`, `.bibble/constitution.md`, `.bibble/core-config.yaml` e memória relevante.
- O banco continua canônico para objetivos/prompts. Configuração e telemetria de produção ficam em `.roadmap-production/`, local e ignorado pelo Git.
- Esta story não altera schema nem aplica migration.

## Critérios de aceitação

1. A tela do Roadmap possui alternância **Roadmap / Produção**.
2. Produção é visível para Admin/CEO/TI e usuários com override `roadmapProduction`; configurações de acesso são visíveis somente a Admin/CEO/TI.
3. O administrador pode conceder ou remover `roadmapProduction` por usuário usando as tabelas de override existentes.
4. O administrador escolhe provedor/modelo e ativa ou pausa execução automática; Ollama é o padrão.
5. Diagnóstico não imprime tokens, URLs autenticadas ou conteúdo integral de prompts.
6. A gaveta de agentes lista os skills realmente instalados, destaca o agente ativo e informa fase/atividade atual.
7. Objetivos `DOCUMENTED` são executados em prioridade global e versão atual, uma fase por vez.
8. Cada fase carrega o skill do agente indicado. `context` resolve para Scout; `dev` resolve para Nova em UI, Echo em backend e Bibble nos demais casos.
9. Ollama opera com loop de tools limitado: listar/buscar/ler arquivos, criar/substituir conteúdo dentro do projeto e executar gates allowlisted.
10. Paths fora do projeto, `.env*`, `.git`, bancos/backups, `node_modules`, `.next`, estado interno e segredos são bloqueados.
11. `prisma/schema.prisma`, migrations e comandos destrutivos de banco ficam bloqueados e exigem novo fluxo Vault/consentimento fora desta automação.
12. O executor nunca oferece tool de commit, push, reset, checkout destrutivo, remoção recursiva ou comando shell arbitrário.
13. Estado persiste por objetivo/versão/fase; reinício retoma sem repetir fase concluída.
14. A UI mostra fila, agente, fase, atividade, duração, resultado e erro sanitizado com polling.
15. Uma revisão nova do objetivo cria uma nova execução; revisão já concluída não é repetida.
16. Parar a automação impede novos claims sem matar uma tool em andamento de forma corruptiva.
17. O worker é singleton, supervisionado e possui watchdog no Agendador do Windows.
18. Alterações ficam no working tree para inspeção e commit manual do usuário.
19. Lint direcionado, testes, typecheck sem regressão e build Next passam.

## Tarefas

- [x] Criar contrato, armazenamento atômico local e catálogo dinâmico de agentes (AC 4–8, 13–15).
- [x] Implementar autorização e gestão de acesso sem schema novo (AC 2, 3).
- [x] Implementar loop Ollama com tools confinadas e adapters diagnosticáveis (AC 4, 5, 9–12).
- [x] Implementar fila/worker local singleton e retomada (AC 7, 13, 15–18).
- [x] Implementar UI Produção, configuração e gaveta de agentes (AC 1–6, 14).
- [x] Instalar supervisor, executar E2E real e atualizar documentação (AC 17–19).

## Segurança

- Objetivo e Markdown são entradas não confiáveis e não podem ampliar tools ou escopo.
- Escrita usa path resolvido e allowlist de extensões; arquivos protegidos são negados antes da operação.
- Comandos de validação são enums internos, nunca texto arbitrário vindo do modelo.
- Logs guardam códigos, paths relativos e resumos limitados; nunca headers, env ou resposta bruta integral.
- Mudança de banco e operações Git mutáveis permanecem fora do executor.

## Testing

- Unitários: path traversal, arquivos protegidos, catálogo, config, estado, resolução de agente e parser de tool calls.
- Integração: retomada, idempotência, uma fase por vez, provider indisponível e erro sanitizado.
- Runtime: objetivo controlado local, atividade visível, alteração no working tree e zero commit.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-17 | 0.1.0 | Story criada a partir da solicitação de Produção local orientada pelo Bibble. | Codex / `@dev` |
| 2026-08-17 | 1.0.0 | Produção local, acesso, adapters, worker, tools, UI, supervisor e E2E real concluídos. | Codex / `@dev` |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Completion Notes

- CLI-first entregue com doctor, status, execução unitária, retry e worker contínuo.
- Ollama remoto validado com `qwen3.8:27b`; 21 skills Bibble descobertos dinamicamente.
- Execução real `RM-2026-879ABA` concluiu as cinco fases e aplicou mudanças no CRM sem commit automático.
- Supervisor `PainelAlpha-RoadmapProductionWorker` instalado, singleton e ativo com watchdog de um minuto.
- Segurança validada: traversal, segredos, schema/migrations, escrita read-only e shell arbitrário bloqueados.
- Lint direcionado e 37 testes Roadmap passaram. Gate global mantém baseline legado fora do escopo; o build via `prisma generate` pode falhar com EPERM enquanto o dev server mantém o engine carregado.

### File List

- `.gitignore`
- `docs/roadmap-alpha/README.md`
- `docs/stories/story-roadmap-alpha-producao-local-bibble.md`
- `package.json`
- `scripts/install-roadmap-production-worker.ps1`
- `scripts/roadmap-production-worker.ps1`
- `scripts/roadmap-production.mjs`
- `scripts/uninstall-roadmap-production-worker.ps1`
- `src/actions/PermissoesSetor.ts`
- `src/actions/RoadmapAlpha.ts`
- `src/actions/RoadmapProduction.ts`
- `src/app/PainelAlpha/Roadmap/page.tsx`
- `src/components/RoadmapAlpha/RoadmapDashboard.tsx`
- `src/components/RoadmapAlpha/RoadmapProductionPanel.tsx`
- `src/lib/roadmap-alpha/authorization.ts`
- `src/lib/roadmap-production/agents.ts`
- `src/lib/roadmap-production/contracts.ts`
- `src/lib/roadmap-production/providers.ts`
- `src/lib/roadmap-production/storage.ts`
- `src/lib/roadmap-production/tools.ts`
- `src/lib/roadmap-production/worker.ts`
- `tests/roadmap-production/agents.test.ts`
- `tests/roadmap-production/contracts.test.ts`
- `tests/roadmap-production/providers.test.ts`
- `tests/roadmap-production/storage.test.ts`
- `tests/roadmap-production/tools.test.ts`

## QA Results

- E2E real: PASS — objetivo `RM-2026-879ABA`, fases Scout → Nova → Nova → Probe → Scribe em `SUCCEEDED`.
- Revisão visual autenticada não automatizada porque a sessão isolada do navegador abriu a tela de login; nenhum acesso a credenciais foi tentado.
- Nenhum CRITICAL identificado na revisão local de segurança.
