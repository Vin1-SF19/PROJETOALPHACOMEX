# Vault — RM-2026-E1E1F7 — retomada aprovada

RESULT: BLOCKED — DATABASE_BACKUP_UNAVAILABLE

Comprovante recebido nesta sessão: `899e0c58b52b67eb52c856c722b5ac6a25b4e75cb56950ad0ff965c994e3b367`, registrado em 2026-09-19T14:00:35.427Z. Aprovação recebida para retomar o escopo registrado; não há nova solicitação de consentimento.

Plano específico preservado em [vault-plan.md](../vault-plan.md), SHA-256 `9a8143fe3f5681d8c1eabd171ebc7ade7ccc0169242cb23d5551d7e635ba8226`: Turso de produção, nova tabela BpmEtapaCardViewConfig, índice único pipelineId/etapaId, FKs Cascade e relações inversas Prisma, sem backfill. Contém SQL, classificação, riscos, alternativa, preflight, ensaio e pós-validação. Rollback preferencial conserva dados e desativa consumidor; DROP da tabela nova exige exportação das configurações e verificação de dependentes conforme plano. Restauração sobre produção não é automática.

Os models BpmPipeline e BpmEtapa foram relidos e continuam literalmente iguais aos citados no plano. Não existe model CardView no schema atual. Nenhum schema ou migration alterado nesta execução.

Tentativa real: `node scripts/turso-backup.mjs 'RM-2026-E1E1F7 fase 3 comprovante 899e0c58'`, exit 1 antes de conectar, configuração TURSO_DATABASE_URL/TURSO_AUTH_TOKEN indisponível. Evidência sanitizada em evidence.json. Nenhum backup novo produzido. Identidade remota, manifesto, idade <48h, SHA-256 do dump, restauração real, integrity_check e foreign_key_check não puderam ser verificados. Nenhum DDL executado. Preflight, migrate diff e ensaio de rollback não executados: pré-condição de backup falhou.

A skill `.agents/skills/vault/SKILL.md` exige “backup completo válido + confirmação explícita”. O bloqueio atual é técnico: disponibilizar configuração Turso pelo mecanismo seguro do projeto ao worker, gerar/verificar backup e então cumprir os demais gates do mesmo plano.

## Entregabilidade

Artefato desta fase: relatório e evidência consumidos pelo administrador/pipeline via repositório/CLI. Artefato funcional esperado: composição compacta por etapa consumida pelo usuário do CRM. Reinspeção: AdminPipelineClient.tsx:949 ainda monta modo=card; FormularioEtapaWorkspace.tsx:880 usa FormularioEtapaRenderer; PipelineBoardClient.tsx:206 deriva apresentação pelo nome da etapa.

AUTO_ADJUSTMENT_REQUIRED: editor e board ainda não compartilham configuração compacta persistida por etapa.
AUTO_ADJUSTMENT_ACCEPTANCE: salvar e recarregar composição em /PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId] → Card do Kanban e conferir a mesma composição no preview e card fechado em /PainelAlpha/AlphaCRM/pipeline/[pipelineId].

Sem DELIVERY_READY funcional.

## Gates e File List

Hash do plano e correspondência literal dos models conferidos; backup falhou. Preservação de schema/plano e git diff --check registrados em final-check.json. Lint, typecheck e testes não repetidos nesta retomada exclusivamente documental: resultados já inspecionados em ../approved-retry-20260919/gates.json (respectivamente exit 124, 134 e 1); nenhuma aprovação global reivindicada. Build não executado.

Arquivos desta sessão: report.md, evidence.json, final-check.json neste diretório; append em docs/stories/story-rm-2026-e1e1f7-card-kanban-configuravel.md e .bibble/memory/journal.md. Alterações preexistentes preservadas; nenhum Git mutável.
