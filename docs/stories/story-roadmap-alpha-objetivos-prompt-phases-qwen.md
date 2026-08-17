# Story: Roadmap Alpha — objetivos globais e documentação automática via Qwen 3.8

## Status

Ready for Review — sistema operacional, migration aplicada e worker persistente validado em 2026-08-15.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@architect`
- quality_gate_tools: `vault`, `prisma-diff`, `lint`, `typecheck`, `test`, `build`, `coderabbit`, `runtime-smoke`

## Origem e rastreabilidade

- Solicitação direta do usuário em 2026-08-15 para construir o Roadmap dentro do Painel Alpha.
- Catálogo canônico: `src/lib/modulos-registry.ts`.
- Referência visual: `src/components/Notas/Central/CentralDeNotas.tsx`.
- Fila Markdown existente: `prompt-phases/README.md`.
- Integração Qwen/Ollama: `src/lib/bibble/client.ts` e `src/lib/bibble/completion.ts`.
- Regras: `AGENTS.md` e `.aiox-core/constitution.md`.
- Blueprint do `@architect`, auditoria Vault e validação `@po` realizados em leitura somente em 2026-08-15.

## Story

**Como** responsável pelo planejamento do Painel Alpha,
**quero** cadastrar objetivos vinculados aos módulos, definir uma prioridade global e acompanhar sua documentação automática em fases de prompt,
**para que** o Qwen 3.8 transforme cada objetivo, sequencialmente, em prompts completos até não restar objetivo sem documentação.

## Escopo

O Roadmap Alpha terá três regiões inspiradas no Bloco de Notas Alpha: módulos à esquerda como filtros, objetivos priorizados no centro e documentação Markdown à direita. O módulo documenta prompts, mas não os executa. A inteligência funciona primeiro por CLI; a UI reutiliza os mesmos serviços de domínio.

## Critérios de aceitação

1. Existe a rota protegida `/PainelAlpha/Roadmap` e a permissão `roadmap` no registry.
2. O filtro mostra todos os itens de `MODULOS_REGISTRY`, inclusive os ocultos pela sidebar, sem liberar dados internos dos módulos.
3. Cada objetivo possui código, módulo, título, contexto, posição global, autor, versão, estado documental e timestamps.
4. Prioridade é uma posição total global: `1` é a maior; inserir, mover ou arquivar reorganiza atomicamente sem duplicidade.
5. Filtrar por módulo não recalcula a posição global.
6. Criar objetivo e enfileirar a primeira geração ocorre na mesma transação.
7. O worker processa um objetivo por vez por `globalPriority ASC`, `createdAt ASC`, `id ASC` e continua até drenar a fila.
8. A integração usa `BIBBLE_OLLAMA_URL`, `OLLAMA_API_KEY` e `ROADMAP_QWEN_MODEL`; a tag exata deve existir em `/api/tags` e ser Qwen 3.8, sem fallback silencioso.
9. O Qwen retorna contrato estruturado validado por Zod; IDs, numeração, slugs e paths são definidos pelo aplicativo.
10. A publicação contém `00-contexto-geral.md`, fases executáveis a partir de `01-` e `_status.md`.
11. Resposta truncada, inválida, vazia ou parcial não recebe estado concluído.
12. O banco é canônico; o filesystem é uma projeção reconciliável.
13. O namespace é `prompt-phases/roadmap-alpha/<module-key>/<objective-code>/rNNNN/`, isolado da fila legada.
14. A escrita usa diretório temporário e rename atômico; destino divergente nunca é sobrescrito.
15. Estados mínimos: `PENDING`, `DOCUMENTING`, `DOCUMENTED`, `RETRY_WAIT`, `FAILED`, `OUTDATED` e `SUPERSEDED`.
16. Falhas transitórias usam backoff limitado; uma falha definitiva não bloqueia os próximos objetivos.
17. Geração é idempotente por `(objectiveId, sourceVersion)` e fase por `(objectiveId, sourceVersion, phaseNumber)`.
18. Claim persistente usa lease, heartbeat e fencing; duas instâncias não processam o mesmo objetivo.
19. Edição material incrementa versão e enfileira novamente; mudar somente prioridade não regenera.
20. Resultado de versão superada nunca substitui a versão atual.
21. Desktop preserva as três regiões; mobile usa gaveta e navegação progressiva, com foco, contraste e reduced motion.
22. Markdown não executa HTML/scripts/links perigosos; objetivo é entrada não confiável contra prompt injection.
23. Logs nunca incluem tokens, URLs autenticadas ou conteúdo integral dos prompts.
24. Existem os comandos `roadmap:doctor`, `roadmap:check-modules`, `roadmap:enqueue`, `roadmap:worker`, `roadmap:reconcile` e `roadmap:export`; `roadmap:sync-modules` é alias read-only de compatibilidade para `roadmap:check-modules`.
25. Nenhuma migration é aplicada sem backup específico restaurável, relatório Vault aprovado, rollback e consentimento explícito.
26. Lint, typecheck, testes, build e CodeRabbit sem issues críticas passam.

## Arquitetura proposta

```text
Cadastro UI/CLI → objetivo + job → worker com lease → Qwen 3.8
→ validação/publicação no banco → exportação atômica → próximo objetivo
```

Quatro conceitos persistentes serão detalhados pelo Data Engineer: objetivo, job, tentativa e artefato. `moduleKey` referencia o registry por contrato de código, sem FK para tabela inexistente.

## Segurança e autorização proposta

- Permissão `roadmap` concede leitura; Admin, CEO e TI realizam mutações globais, sujeito à confirmação do usuário.
- Server Actions usam `auth()`, Zod e autorização server-side.
- O catálogo completo expõe apenas metadados do registry.
- Qwen recebe somente o objetivo e metadados públicos necessários.
- Slugs são internos e todo path resolvido permanece no namespace do Roadmap.
- O módulo nunca executa os prompts gerados.

## Tarefas

- [x] Resolver decisões de produto/runtime e o gate de persistência (AC 1, 2, 12, 13, 25).
- [x] Fechar schema, SQL aditivo e rollback com Data Engineer/Vault (AC 3, 4, 6, 15–20, 25).
- [x] Implementar domínio, autorização, prioridade e versionamento (AC 1–6, 17–20).
- [x] Implementar preflight e contrato Qwen (AC 8–11, 22, 23).
- [x] Implementar fila, lease, retry e reconciliação (AC 7, 15–20).
- [x] Implementar CLI antes da UI (AC 7, 8, 24).
- [x] Implementar exportação Markdown segura (AC 9–14, 17).
- [x] Implementar UI responsiva em três regiões (AC 1, 2, 5, 15, 21, 22).
- [x] Executar gates e atualizar esta story (AC 26; baselines externos e indisponibilidade do CodeRabbit registrados em QA Results).

## Decisões operacionais concluídas

1. O worker foi instalado como tarefa agendada `PainelAlpha-RoadmapWorker`, inicia no logon, reinicia após falha, possui mutex singleton, heartbeat e encerramento sem processos órfãos.
2. A política segura foi implementada: permissão `roadmap` para leitura e roles Admin/CEO/TI para mutações globais.
3. Migration autorizada, aplicada e validada conforme `docs/roadmap-alpha/migration-preflight-2026-08-15.md`.

## Evidência do gate de backup

O snapshot remoto de `2026-08-15 11:54 BRT` foi formalmente selecionado como baseline e restaurado em banco temporário descartável. SHA-256, `quick_check`, chaves estrangeiras, 191 tabelas, 257 índices/triggers e 36.219 linhas conferiram integralmente. O banco temporário foi removido após a validação. Detalhes: `docs/roadmap-alpha/migration-preflight-2026-08-15.md`.

## Fora do escopo

- Executar automaticamente os prompts documentados.
- Misturar arquivos do Roadmap com a fila numerada ativa na raiz.
- Permitir ao cliente escolher endpoint, headers, modelo arbitrário ou paths.

## Testing

- Unitários: validação, prioridade, hash, sanitização, slugs, paths e parser Qwen.
- Integração: objetivo+job, concorrência, lease, retry, supersessão, publicação e exportação.
- Segurança: sessão, permissão, IDOR, prompt injection, path traversal e Markdown perigoso.
- UI: ordem global após filtro, estados, teclado e responsividade.

## CodeRabbit Integration

- Primary type: Integration.
- Secondary types: Database, API, Frontend, Security e Architecture.
- Complexity: High.
- Focos: autorização, fencing/idempotência, segredos, validação Qwen, filesystem e migration reversível.
- Self-healing: `@dev` light, no máximo 2 iterações, somente achados críticos.

## Predicted File List

- Criar: `src/app/PainelAlpha/Roadmap/`, `src/components/RoadmapAlpha/`, `src/lib/roadmap-alpha/`, `src/lib/validations/roadmap-alpha.ts`, `scripts/roadmap-alpha.mjs`, `tests/roadmap-alpha/` e migration aprovada.
- Editar: `package.json`, `prisma/schema.prisma`, `src/lib/modulos-registry.ts`, `.env.example` e, se aprovado, `vercel.json`.

## Change Log

- 2026-08-15: story criada pelo `@sm`, revisada pelo `@architect`, auditada pelo Vault e mantida em Draft pelo `@po`.
- 2026-08-15: migration explicitamente autorizada, aplicada e validada; domínio, CLI, worker Qwen, projeção e UI implementados pelo `@dev`. Story mantida em `In Progress` até instalar o worker como serviço contínuo.
- 2026-08-15: versão 1.0.0 concluída; worker persistente instalado, edição material/versionamento e fencing reforçados, E2E real de duas revisões aprovado. Status alterado para `Ready for Review`.
- 2026-08-17: versão 1.0.1; polling ao vivo da fila/documentação implementado, objetivo pendente recuperado com cinco fases e tarefa agendada reforçada com watchdog de um minuto validado por parada real.

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Completion Notes

- Migration aditiva aplicada e verificada no Turso sem alteração de contagens preexistentes.
- Rota `/PainelAlpha/Roadmap` construída com projetos à esquerda, objetivos priorizados no centro e documentação à direita; mobile usa navegação progressiva.
- Criação persiste objetivo e job atomicamente; prioridade, edição material, arquivamento e nova revisão mantêm a ordenação global e preservam o histórico.
- Worker sequencial implementado com lease, heartbeat, fencing, retry/backoff, dead-letter e erros sanitizados.
- Qwen 3.8 usa tag exata e contrato Zod; respostas truncadas/parciais não são publicadas.
- Projeção atômica e idempotente implementada em `prompt-phases/roadmap-alpha/<module>/<code>/rNNNN` sem sobrescrita divergente.
- CLI implementado: doctor, check/sync modules, enqueue, worker, reconcile e export.
- Worker persistente instalado como tarefa agendada no Windows; parada/reinício foi validada sem processos órfãos e o estado final é `Running`.
- Dois E2Es reais via serviço comprovaram criação, Qwen, persistência, projeção e revisão `r0001 → r0002`; todos os dados técnicos foram removidos ao final.
- UI acompanha fila e geração a cada dois segundos e publica visualmente os prompts sem F5; watchdog religa o worker em até um minuto se a tarefa parar.
- ESLint direcionado passou; 26 testes do Roadmap passaram; build Next de produção passou. Typecheck mantém somente cinco diagnósticos preexistentes fora do Roadmap.
- Verificação visual automatizada ficou bloqueada na autenticação do navegador isolado; nenhuma credencial foi solicitada ou usada.

### File List

- `.env.example`
- `docs/roadmap-alpha/README.md`
- `docs/roadmap-alpha/migration-preflight-2026-08-15.md`
- `docs/stories/story-roadmap-alpha-fundacao-cli-contrato-qwen.md`
- `docs/stories/story-roadmap-alpha-objetivos-prompt-phases-qwen.md`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `prisma/migrations/20260815130000_add_roadmap_alpha/migration.sql`
- `scripts/roadmap-alpha.mjs`
- `scripts/roadmap-alpha-e2e.mjs`
- `scripts/roadmap-alpha-worker.ps1`
- `scripts/install-roadmap-alpha-worker.ps1`
- `scripts/uninstall-roadmap-alpha-worker.ps1`
- `src/actions/RoadmapAlpha.ts`
- `src/app/PainelAlpha/Roadmap/page.tsx`
- `src/components/RoadmapAlpha/RoadmapDashboard.tsx`
- `src/components/layout/GlobalSidebar.tsx`
- `src/lib/bibble/client.ts`
- `src/lib/modulos-registry.ts`
- `src/lib/roadmap-alpha/authorization.ts`
- `src/lib/roadmap-alpha/catalog.ts`
- `src/lib/roadmap-alpha/contracts.ts`
- `src/lib/roadmap-alpha/doctor.ts`
- `src/lib/roadmap-alpha/maintenance.ts`
- `src/lib/roadmap-alpha/objectives.ts`
- `src/lib/roadmap-alpha/projection.ts`
- `src/lib/roadmap-alpha/qwen-generator.ts`
- `src/lib/roadmap-alpha/runtime-config.ts`
- `src/lib/roadmap-alpha/worker.ts`
- `tests/roadmap-alpha/`

## QA Results

- `PASS` — migration dry-run e remota, integridade/FKs, ESLint direcionado, 26 testes, CLI/Qwen real, E2E de duas revisões, supervisor sem órfãos e build Next.
- `KNOWN BASELINE` — cinco erros de typecheck preexistentes fora do escopo.
- `KNOWN BASELINE` — suíte global: 1.426/1.428 testes passaram; as duas falhas estão em PPTX e CRM, fora do Roadmap. O lint global alcança arquivos legados e de tooling não incluídos no escopo; o lint direcionado está limpo.
- `ENVIRONMENTAL` — CodeRabbit não está disponível neste ambiente; nenhuma aprovação foi inventada. Revisão formal Pre-PR permanece como processo externo, sem impedir a operação local validada.
