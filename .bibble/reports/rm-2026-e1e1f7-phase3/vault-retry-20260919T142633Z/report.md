# Vault — RM-2026-E1E1F7 — retomada 2026-09-19T14:26:33.652629+00:00

RESULT: BLOCKED

Comprovante recebido: `bb986dae9e9af6e5ac3a8fd174c990b335e2d36a0378ec08140531d959e44d95`. Referencia a tentativa bloqueada anterior; não amplia o delta. Plano auditável preservado em `../vault-plan.md`, SHA-256 `9a8143fe3f5681d8c1eabd171ebc7ade7ccc0169242cb23d5551d7e635ba8226`. Nenhuma nova confirmação solicitada.

Alvo previsto: Turso de produção do Painel Alpha. Identidade remota não confirmada. Comando executado: `node scripts/turso-backup.mjs 'RM-2026-E1E1F7 fase 3 card Kanban por etapa'`. Exit 1: TURSO_DATABASE_URL e/ou TURSO_AUTH_TOKEN indisponíveis, antes de conectar. Nenhum dump produzido nesta tentativa; restauração, integrity_check, foreign_key_check, SHA-256 do dump e idade inferior a 48h não puderam ser validados. Não foram expostos segredos.

O plano específico existente descreve BpmEtapaCardViewConfig com id, pipelineId, etapaId, camposJson, versao e timestamps, unicidade pipelineId/etapaId, duas FKs Cascade; sem backfill nem alteração física dos pais. BpmPipeline e BpmEtapa foram relidos e continuam literalmente iguais às citações do plano. Model compacto continua ausente. O plano contém fontes dos dados, preflight, comandos, classificação do delta, validação e alternativa sem DDL. Risco: lock breve ao criar tabela e ausência de campos configurados até publicação. Rollback preferencial desativa o consumidor e preserva dados; DROP da tabela perde configurações futuras e exige as condições do plano, incluindo exportação. Nenhum rollback executado ou ensaiado nesta retomada.

Artefato desta fase: relatório/evidência consumidos pelo administrador e pipeline via repositório/CLI. Artefato funcional esperado: composição compacta persistida por etapa, consumida pelo operador no board. Caminho reinspecionado: Alpha CRM → Configurações → /PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId] → Card do Kanban. AdminPipelineClient.tsx:949 monta modo="card"; FormularioEtapaWorkspace.tsx:443 chama SalvarFormularioEtapaBpm e :880 usa FormularioEtapaRenderer. Consumidor operacional: /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → KanbanCard em PipelineBoardClient.tsx:182. Não há evidência para DELIVERY_READY.

AUTO_ADJUSTMENT_REQUIRED: a aba Card do Kanban salva formulário; falta configuração compacta persistida consumida pelo board.
AUTO_ADJUSTMENT_ACCEPTANCE: salvar composição por etapa, recarregar e confirmar preview e card fechado iguais.

Gates executados: hash do plano, comparação literal dos models atuais, ausência do model compacto, rastreamento editor/preview/board e tentativa real de backup. Whitespace e preservação do schema registrados em final-check.json. Lint, typecheck e testes não repetidos nesta retomada documental sem mudança de código; resultados anteriores permanecem sem aprovação. Preflight remoto, migrate diff, ensaio de rollback e aplicação não executados por falta de backup. Nenhum schema/migration alterado, nenhuma escrita remota ou Git mutável.

Arquivos afetados: report.md, evidence.json e final-check.json neste diretório; append na story e journal. Alterações anteriores preservadas.

Retomada necessária: disponibilizar configuração Turso no ambiente autorizado ou .env.local pelo mecanismo seguro do projeto, gerar e verificar backup completo antes dos demais gates. Repetir aprovação não supre configuração ausente.

A [skill Vault](../../../../.agents/skills/vault/SKILL.md) exige: “Não prossiga sem evidência verificável do backup e confirmação explícita da alteração exata.” Falta o backup verificável.

PIPELINE_RESULT: {"status":"BLOCKED","code":"DATABASE_BACKUP_UNAVAILABLE","retryable":true}
