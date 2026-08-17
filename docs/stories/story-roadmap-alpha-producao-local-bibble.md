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
- Ollama/Qwen 3.8 é exclusivo da documentação, geração e melhoria de prompts. O desenvolvimento usa Claude Code ou Codex CLI; Claude é a preferência padrão e o outro adapter assume automaticamente em falhas de quota, limite, autenticação ou disponibilidade.
- MCP não é requisito para a primeira versão: cada adapter usa o protocolo nativo disponível. Novos adapters poderão ser adicionados sem alterar o contrato da UI.
- O cérebro é o catálogo instalado em `.claude/skills/bibble-squad/`, junto de `AGENTS.md`, `.bibble/constitution.md`, `.bibble/core-config.yaml` e memória relevante.
- O banco continua canônico para objetivos/prompts. Configuração e telemetria de produção ficam em `.roadmap-production/`, local e ignorado pelo Git.
- Esta story não altera schema nem aplica migration.

## Critérios de aceitação

1. A tela do Roadmap possui alternância **Roadmap / Produção**.
2. Produção é visível para Admin/CEO/TI e usuários com override `roadmapProduction`; configurações de acesso são visíveis somente a Admin/CEO/TI.
3. O administrador pode conceder ou remover `roadmapProduction` por usuário usando as tabelas de override existentes.
4. O administrador escolhe o cérebro de desenvolvimento e ativa ou pausa execução automática; Claude é a preferência padrão e Codex é o fallback.
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
20. Cada execução na fila permite excluir, tentar novamente, pausar e retomar; uma revisão falha ou pausada não bloqueia outras revisões pendentes.
21. Uma reprovação devolve automaticamente o feedback para a implementação, que corrige e é verificada novamente; bloqueios corrigíveis usam retry com cooldown e limite de segurança, e fases de implementação atribuídas a agentes read-only são roteadas para Nova/Echo.
22. O Roadmap separa objetivos em Pendentes, Em desenvolvimento, Concluídos, Excluídos e Arquivados; excluídos são apagados definitivamente depois de três dias.
23. Ao concluir uma execução, o worker publica `99-relatorio-conclusao.md` com resultado, arquivos, fases, agentes, tentativas, o que foi feito e como foi feito.
24. A fila de Produção exibe objetivos como accordions de abertura exclusiva, prioriza a gaveta do objetivo ativo, lista seus prompts, destaca o prompt em execução e abre o Markdown selecionado no painel amplo.
25. Cada campo textual de criação e edição oferece **Melhorar com IA** usando o Qwen 3.8 configurado, sem persistir a sugestão antes do envio do formulário.
26. Cada card de objetivo permite relatar um erro global, melhorar o feedback com Qwen 3.8 e reenfileirar todas as fases; o feedback é obrigatório para todos os agentes e fica rastreado no relatório final do objetivo.
27. O modal de criação escolhe Claude ou Codex por objetivo, com Claude pré-selecionado; a preferência fica no estado local, acompanha todas as fases Bibble e alterna automaticamente para o outro adapter quando o primeiro esgota créditos ou fica indisponível. Qwen 3.8 permanece responsável pela documentação e pelos botões de melhoria.

## Tarefas

- [x] Criar contrato, armazenamento atômico local e catálogo dinâmico de agentes (AC 4–8, 13–15).
- [x] Implementar autorização e gestão de acesso sem schema novo (AC 2, 3).
- [x] Implementar loop Ollama com tools confinadas e adapters diagnosticáveis (AC 4, 5, 9–12).
- [x] Implementar fila/worker local singleton e retomada (AC 7, 13, 15–18).
- [x] Implementar UI Produção, configuração e gaveta de agentes (AC 1–6, 14).
- [x] Instalar supervisor, executar E2E real e atualizar documentação (AC 17–19).
- [x] Adicionar controles seguros por execução e remover o bloqueio global causado por falhas antigas (AC 20).
- [x] Implementar ciclo automático implementação → verificação → correção, com feedback persistido e cooldown (AC 21).
- [x] Implementar ciclo de vida, lixeira com retenção e relatório final por revisão (AC 22, 23).
- [x] Reestruturar Produção por prompt e adicionar melhoria assistida dos campos (AC 24, 25).
- [x] Implementar relato de erro, retrabalho dirigido pelo feedback e rastreabilidade no relatório final (AC 26).
- [x] Separar Qwen da implementação, persistir cérebro por objetivo e adicionar fallback Claude ↔ Codex (AC 27).

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

| Date       | Version | Description                                                                                                                            | Author         |
| ---------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 2026-08-17 |   0.1.0 | Story criada a partir da solicitação de Produção local orientada pelo Bibble.                                                          | Codex / `@dev` |
| 2026-08-17 |   1.0.0 | Produção local, acesso, adapters, worker, tools, UI, supervisor e E2E real concluídos.                                                 | Codex / `@dev` |
| 2026-08-17 |   1.0.1 | Controles por execução e isolamento de falhas entre revisões adicionados à fila.                                                       | Codex / `@dev` |
| 2026-08-17 |   1.0.2 | Fases analíticas separadas de escrita, encerramento obrigatório do modelo e troca atômica do estado local.                             | Codex / `@dev` |
| 2026-08-17 |   1.0.3 | Autocorreção após reprovação, retry automático e reparo de fases de implementação atribuídas a agentes read-only.                      | Codex / `@dev` |
| 2026-08-17 |   1.0.4 | Escrita confinada do Scribe e recuperação automática de encerramentos bloqueados por read-only.                                        | Codex / `@dev` |
| 2026-08-17 |   1.1.0 | Abas de ciclo de vida, lixeira de três dias, relatório final, fila por prompt e melhoria de campos com Qwen 3.8.                       | Codex / `@dev` |
| 2026-08-17 |   1.2.0 | Relato de erro global por objetivo, melhoria do feedback com IA e retrabalho rastreado no relatório final.                             | Codex / `@dev` |
| 2026-08-17 |   1.2.1 | Cards de objetivos convertidos em accordions exclusivos para uma fila de Produção mais limpa.                                          | Codex / `@dev` |
| 2026-08-17 |   1.3.0 | Claude/Codex definidos como cérebros por objetivo, com Claude padrão, fallback automático e Qwen exclusivo para documentação/melhoria. | Codex / `@dev` |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Completion Notes

- CLI-first entregue com doctor, status, execução unitária, retry e worker contínuo.
- Ollama remoto validado com `qwen3.8:27b`; 21 skills Bibble descobertos dinamicamente.
- Execução real `RM-2026-879ABA` concluiu as cinco fases e aplicou mudanças no CRM sem commit automático.
- Supervisor `PainelAlpha-RoadmapProductionWorker` instalado, singleton e ativo com watchdog de um minuto.
- Fila permite excluir, pausar, retomar e tentar novamente; revisões falhas não bloqueiam a próxima revisão.
- Execução real da revisão v3 retomada, implementada, aprovada pelo Probe e encerrada pelo Scribe com todas as cinco fases concluídas.
- Segurança validada: traversal, segredos, schema/migrations, escrita read-only e shell arbitrário bloqueados.
- Fila de Produção reorganizada por prompt; relatório final real gerado para `RM-2026-C4A90D` em `99-relatorio-conclusao.md`.
- Lint direcionado e 49 testes Roadmap passaram; o typecheck mantém somente o baseline externo já documentado.
- O modal de objetivo persiste Claude/Codex localmente; Claude é o padrão, Codex assume em falta de crédito/limite e o relatório final registra a preferência usada.

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
- `src/lib/roadmap-alpha/improve-with-ai.ts`
- `src/lib/roadmap-alpha/objectives.ts`
- `src/lib/roadmap-production/agents.ts`
- `src/lib/roadmap-production/contracts.ts`
- `src/lib/roadmap-production/completion-report.ts`
- `src/lib/roadmap-production/providers.ts`
- `src/lib/roadmap-production/storage.ts`
- `src/lib/roadmap-production/tools.ts`
- `src/lib/roadmap-production/worker.ts`
- `tests/roadmap-production/agents.test.ts`
- `tests/roadmap-alpha/improve-with-ai.test.ts`
- `tests/roadmap-production/completion-report.test.ts`
- `tests/roadmap-production/contracts.test.ts`
- `tests/roadmap-production/providers.test.ts`
- `tests/roadmap-production/storage.test.ts`
- `tests/roadmap-production/tools.test.ts`

## QA Results

- E2E real: PASS — objetivo `RM-2026-879ABA`, fases Scout → Nova → Nova → Probe → Scribe em `SUCCEEDED`.
- Revisão visual autenticada não automatizada porque a sessão isolada do navegador abriu a tela de login; nenhum acesso a credenciais foi tentado.
- Nenhum CRITICAL identificado na revisão local de segurança.
