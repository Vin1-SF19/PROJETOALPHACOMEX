# RM-2026-EB2898 — CRM Config Save Consistency (P0-4)

## Status

Concluída

## Contexto

A central administrativa do Alpha CRM mistura alterações locais com gravações imediatas. O botão global “Publicar alterações” cobre somente ativação de campos, enquanto etapas, campos, formulários, transições, visibilidade, SLA e cadência possuem gravações independentes. O CAS existente usa `BpmPipeline.updatedAt`, embora mutações nos filhos não atualizem esse valor.

P0-1, P0-2 e P0-3 estão presentes na base pelos commits `a43c6f64`, `688da908` e `ad6aaaf2`.

## Escopo

1. Usar um contador inteiro `BpmPipeline.configVersion` como autoridade de concorrência.
2. Carregar configuração e `baseVersion` no mesmo read model.
3. Manter alterações da central em estado pendente até uma única publicação.
4. Validar e aplicar o agregado dentro de uma única transação.
5. Bloquear publicação baseada em versão antiga sem qualquer escrita.
6. Fazer “Descartar” restaurar exclusivamente o estado publicado.
7. Distinguir vazio, acesso negado, validação, infraestrutura e conflito.
8. Preservar o runtime canônico entregue por P0-1/P0-2/P0-3.

## Fora de escopo

- Tabela de revisões, snapshots persistidos, checksum ou histórico completo.
- Rollback para versões antigas, diff universal ou importação/exportação.
- Nova camada draft/published no banco.
- Redesign da Central de Configurações ou novas funcionalidades BPM.

## Contrato mínimo

`EDITAR localmente → PUBLICAR(baseVersion, snapshot) → validar → CAS configVersion → aplicar filhos na mesma transação → auditoria → commit → efeitos pós-commit`.

Em conflito, o snapshot local permanece disponível e o usuário precisa recarregar/reconciliar explicitamente. Em qualquer falha dentro da transação, filhos, auditoria e contador sofrem rollback.

## Vault

- Ambiente: Turso remoto de produção.
- Backup: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-09T20-53-43-145Z.sql` (fora do Git).
- Manifesto: arquivo homônimo `.manifest.json`; 306 tabelas, 84.064 linhas, 107.678.822 bytes.
- SHA-256: `bedbc0e0ded6ac3db8656f3e8c10a272ba27c6b09fafec46444481c34767d7a5`.
- SQL autorizado: `ALTER TABLE "BpmPipeline" ADD COLUMN "configVersion" INTEGER NOT NULL DEFAULT 1;`.
- SHA-256 do SQL com newline: `432b3152fd688a160cb0f05d424102e36d9e67688e59ba8615c1b73448e692c9`.
- Autorização específica recebida em 2026-09-09.

## Critérios de aceite

- [x] Publicação bem-sucedida aplica integralmente as alterações.
- [x] Falha intermediária reverte filhos, auditoria e contador.
- [x] `configVersion` incrementa uma vez e somente após commit bem-sucedido.
- [x] `baseVersion` antiga retorna conflito sem sobrescrever configuração.
- [x] `updatedAt` não participa como autoridade exclusiva de concorrência.
- [x] Descartar restaura o último snapshot publicado sem gravar no servidor.
- [x] Erro de carga não é representado como configuração vazia.
- [x] Escritores pertencentes ao workspace não contornam a publicação.
- [x] P0-1, P0-2 e P0-3 permanecem verdes no escopo focado.

## Fases

- [x] Fase 0 — objetivo e pré-requisitos auditados em modo somente leitura.
- [x] Fase 1 — leitores, escritores e integração da central mapeados.
- [x] Fase 2 — story criada antes da implementação funcional.
- [x] Fase 3 — migration validada e aplicada conforme checkpoint Vault.
- [x] Fase 4 — backend transacional e concorrência implementados.
- [x] Fase 5 — editor pendente, Publicar e Descartar unificados.
- [x] Fase 6 — testes de contrato e regressão implementados.
- [x] Fase 7 — gates, segurança, integração e relatório final.

## Matriz de testes

- [x] Commit integral do snapshot.
- [x] Rollback em falha intermediária.
- [x] Incremento único de `configVersion`.
- [x] Duas sessões com a mesma `baseVersion`.
- [x] Conflito preserva estado vencedor e rascunho perdedor.
- [x] Alteração de filho independe de `updatedAt` para detecção.
- [x] Descartar remove apenas pendências locais.
- [x] Erro de carga não vira coleção vazia.
- [x] Regressões P0-1/P0-2/P0-3.

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- Diagnóstico inicial: `src/actions/bpm/ConfiguracaoPipeline.ts` usa `updatedAt` e a UI possui writers imediatos nos editores filhos.
- `prisma migrate diff` sugere reconstrução da tabela para SQLite; foi rejeitada em favor do `ALTER TABLE ADD COLUMN` aditivo autorizado.

### Completion Notes

- A migration aditiva foi aplicada no Turso de produção após backup completo validado; quatro pipelines foram inicializados em `configVersion = 1`, com zero violações de chave estrangeira.
- A publicação principal passou a usar snapshot completo, validação estrita e compare-and-swap transacional por `configVersion`. Conflitos não escrevem dados e preservam o rascunho local.
- Etapas, fluxo e ativação de campos são publicados juntos; configurações de campo, formulário, visibilidade, SLA, cadência e substatus continuam como publicações independentes e explícitas, incrementando a mesma versão na própria transação.
- O botão Descartar restaura o último snapshot confirmado sem chamada ao servidor. Erros de carga bloqueiam o editor e não são convertidos em listas vazias.
- Validação de segurança reforçada para cores, pertencimento das transições ao pipeline e complexidade linear das validações.
- Gates do escopo: 26/26 testes P0-4 e 172/172 regressões P0-1/P0-2/P0-3; build, Prisma validate, ESLint do escopo e `git diff --check` aprovados.
- A suíte BPM mantém seis falhas preexistentes fora do escopo (876/882 aprovados). Lint/typecheck globais mantêm débitos preexistentes documentados no relatório.

### File List

- [x] `docs/stories/story-rm-2026-eb2898-crm-config-save-consistency.md`
- [x] `prisma/schema.prisma`
- [x] `prisma/migrations/20260909211000_bpm_pipeline_config_version/migration.sql`
- [x] `src/lib/bpm/config-version.ts`
- [x] `src/lib/bpm/pipeline-config-publicacao.ts`
- [x] `src/actions/bpm/{ConfiguracaoPipeline,Cadencias,Campos,Etapas,FormulariosEtapa,Pipelines,Sla,SubStatus,Transicoes,VisibilidadeEtapas}.ts`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/{AdminPipelineClient,CadenciaEtapasSection,EtapaAvancadaSection,FormularioEtapaWorkspace,SlaConfigForm,SlaConfigSection,VisibilidadeEtapasSection,page}.tsx`
- [x] `tests/bpm/{configuracao-pipeline-publicacao-action,pipeline-config-version-transaction,pipeline-config-publicacao,pipeline-config-workspace,configuracao-pipeline-confiavel}.test.ts`
- [x] `tests/bpm/{cadencias-actions,campos-configuraveis-actions,formularios-etapa-save,pipelines-etapas-admin,visibilidade-etapa-actions}.test.ts`
- [x] `.bibble/memory/{architecture,codebase-map,decisions,integration-points,journal}.md`
- [x] `docs/reports/crm-config-save-consistency-p0-4.md`

### Change Log

- 2026-09-09: diagnóstico, story e checkpoint Vault registrados.
- 2026-09-09: migration de produção autorizada, aplicada e verificada; publicação consistente, concorrência, descarte, UI e testes concluídos.
