# P0-4 — CRM Config Save Consistency

## Resultado

A RM-2026-EB2898 foi concluída em branch/worktree isolado. A configuração principal de pipeline agora segue o contrato:

`EDITAR LOCALMENTE → PUBLICAR(baseVersion, snapshot) → VALIDAR → CAS → GRAVAR FILHOS + AUDITORIA → COMMIT → EFEITOS PÓS-COMMIT`.

P0-1, P0-2 e P0-3 foram confirmadas na base pelos commits `a43c6f64`, `688da908` e `ad6aaaf2`. O runtime canônico entregue nessas tasks não foi redesenhado.

## Fluxo anterior

- O botão global publicava somente a ativação de campos.
- Alterações em etapas e em vários editores filhos eram gravadas imediatamente.
- A concorrência dependia de `BpmPipeline.updatedAt`, embora alterações nos filhos não atualizassem obrigatoriamente esse valor.
- Uma falha de carga de dados auxiliares podia ser interpretada pela tela como coleção vazia.
- Não havia um contrato visual inequívoco entre rascunho local, publicação independente e estado efetivamente publicado.

## Fluxo final

- Nome, cor, ordem, atividade, estado inicial/final das etapas, transições e ativação de campos ficam no rascunho principal.
- “Publicar rascunho principal” envia o snapshot completo com a versão-base carregada.
- O backend autentica, valida o schema e a integridade do agregado, executa o compare-and-swap e grava as alterações e a auditoria na mesma transação serializável.
- Falha ou conflito aborta integralmente a transação. Revalidação de cache e evento em tempo real ocorrem somente depois do commit.
- “Descartar” restaura o último snapshot confirmado apenas no cliente, sem escrita no banco.
- Configuração individual de campo, composição de formulário, visibilidade, SLA, cadência e substatus permanecem operações independentes e explícitas. Cada uma incrementa `configVersion` dentro de sua própria transação, invalidando rascunhos principais antigos.
- Enquanto o rascunho principal possui pendências, publicações independentes ficam bloqueadas para evitar perda silenciosa do estado local durante o refresh.

## ConfigVersion e migration

Fonte de concorrência: `BpmPipeline.configVersion Int @default(1)`.

Migration: `prisma/migrations/20260909211000_bpm_pipeline_config_version/migration.sql`.

SQL autorizado:

```sql
ALTER TABLE "BpmPipeline" ADD COLUMN "configVersion" INTEGER NOT NULL DEFAULT 1;
```

- SHA-256 do statement autorizado, incluindo newline final: `432b3152fd688a160cb0f05d424102e36d9e67688e59ba8615c1b73448e692c9`.
- SHA-256 do artefato de migration, que também contém comentários explicativos: `c4cbb8701132e032f8e61d516ffcf405cd0c47b245d77a50cc9f4145fb523438`.
- Aplicação: Turso remoto de produção, após autorização explícita do usuário.
- Antes: coluna ausente, quatro pipelines, zero violações de chave estrangeira.
- Depois: coluna `INTEGER NOT NULL DEFAULT 1`, quatro pipelines em versão 1 e zero violações de chave estrangeira.
- A operação foi aditiva; não removeu nem reescreveu registros operacionais.

## Evidência Vault e rollback

- Backup completo pré-mudança: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-09T20-53-43-145Z.sql`.
- Manifesto: arquivo homônimo `.manifest.json`.
- Conteúdo: 306 tabelas, 84.064 linhas e 107.678.822 bytes.
- SHA-256: `bedbc0e0ded6ac3db8656f3e8c10a272ba27c6b09fafec46444481c34767d7a5`.
- Restore de teste: concluído, `integrity_check = ok`, zero violações de chave estrangeira.
- Os artefatos permanecem fora do Git.

Rollback operacional: interromper writes, restaurar o backup verificado e validar contagens/integridade antes de reabrir o sistema. Como SQLite/Turso não suporta remoção simples de coluna, o rollback estrutural isolado exigiria reconstrução controlada da tabela; a restauração integral é a opção segura já testada.

## Concorrência

O `updatedAt` deixou de ser a autoridade de concorrência. A publicação usa um CAS atômico:

```text
UPDATE BpmPipeline
SET configVersion = configVersion + 1
WHERE id = pipelineId AND configVersion = baseVersion
```

Se nenhuma linha for alterada, a resposta é conflito e nenhuma mudança de filho ou auditoria é persistida. Assim, duas sessões abertas na mesma versão não podem publicar o snapshot completo sucessivamente: a primeira vence; a segunda preserva o próprio rascunho e precisa recarregar/reconciliar.

## Operações transacionais

Na publicação principal, fazem parte da mesma transação:

- CAS/incremento de `configVersion`;
- criação e atualização de etapas;
- criação e atualização de transições;
- ativação/desativação de campos;
- registro de auditoria com versão anterior, nova versão e resumo do diff.

Publicações independentes existentes foram mantidas como comandos delimitados, sem criar um agregado artificial maior. Elas incrementam a versão na própria transação depois da respectiva alteração e auditoria. Não foi criada sincronização paralela, camada persistida de draft, histórico de versões ou mecanismo de rollback funcional, conforme o escopo.

## Validação e segurança

- Payload Zod estrito, limites de tamanho e cores somente em `#RRGGBB` ou `null`.
- Toda transição precisa referenciar etapas do pipeline proposto, inclusive quando bloqueada.
- IDs novos aceitam apenas o contrato explícito de identidade de rascunho.
- Integridade de etapa inicial/final, ordem, alcance do fluxo, duplicidades e catálogos de seleção é validada antes do CAS.
- A validação usa mapas/adjacências lineares para evitar custo quadrático em payloads administrativos grandes.
- Revisão Anubis: aprovada, sem achados críticos ou importantes após os hardenings.
- CodeRabbit CLI não estava instalado no ambiente; a ausência foi registrada e não houve instalação implícita.

## Erros e descarte

- Falha de carga principal produz erro explícito ou `notFound`, conforme o caso.
- Falha de catálogo, transições, SLA, serviços ou cadências bloqueia o editor com mensagem, sem converter o resultado para lista vazia.
- Validação, conflito e infraestrutura possuem mensagens distintas.
- Em conflito, o rascunho perdedor não é apagado automaticamente.
- Descartar afeta somente etapas, transições e campos pendentes do snapshot principal e não executa action no servidor.

## Testes e gates

- P0-4 focado: **26/26 aprovados**, em cinco arquivos.
- Regressão focada P0-1/P0-2/P0-3: **172/172 aprovados**, em vinte arquivos.
- Suíte BPM: **876/882 aprovados**; seis falhas preexistentes, reproduzidas no baseline, em `membros-card-ui`, `fechado-ui` e `criar-card-nova-empresa`.
- Suíte global: **2.685 aprovados, 27 falhos e 1 todo**. As falhas globais são preexistentes e externas ao diff; o baseline anterior possuía 28 falhas.
- ESLint dos arquivos TypeScript/TSX alterados: aprovado, zero ocorrência.
- `npm run lint` global: 2.482 erros e 1.252 avisos preexistentes, mesma linha de base da P0-3.
- `npm run typecheck`: 16 erros preexistentes fora dos arquivos da task (`node:sqlite`, apresentações geradas, rotas de geração de documentos, Habilitação Radar e calendário).
- `npm run build`: aprovado.
- `npx prisma validate`: aprovado.
- Restore/migration em banco de teste: aprovado e idempotência estrutural confirmada por preflight.
- `git diff --check`: aprovado.

## Riscos e itens deliberadamente não implementados

- Os editores filhos continuam sendo publicações independentes. O contrato está explícito e todos invalidam a versão global; unificá-los em um mega-snapshot aumentaria o risco sem ser necessário para a consistência pedida.
- Existem campos de seleção ativos sem catálogo nos pipelines Revisão de Radar, Financeiro e Operacional. A tela oferece “Preparar desativação segura”; nenhum dado de produção foi alterado automaticamente.
- Uma transição histórica permitida para etapa inativa no Financeiro foi preservada. Ela é aceita somente enquanto permanecer inalterada; criar ou habilitar nova transição para etapa inativa continua proibido.
- Não foram criados histórico completo de versões, snapshots persistidos, draft no banco, rollback para versões anteriores nem redesign amplo.

## Estado Git de entrega

- Branch: `feat/crm-config-save-consistency`.
- Worktree: `painel-alpha-worktrees/crm-config-save-consistency`.
- A task está isolada e pronta para integração posterior na `main`.
- Nenhum backup ou segredo foi adicionado ao versionamento.

### `git diff --stat`

`39 files changed, 1.174 insertions(+), 366 deletions(-)`

### `git status --short`

Snapshot pré-commit:

```text
M  .bibble/memory/architecture.md
M  .bibble/memory/codebase-map.md
M  .bibble/memory/decisions.md
M  .bibble/memory/integration-points.md
M  .bibble/memory/journal.md
A  docs/reports/crm-config-save-consistency-p0-4.md
A  docs/stories/story-rm-2026-eb2898-crm-config-save-consistency.md
A  prisma/migrations/20260909211000_bpm_pipeline_config_version/migration.sql
M  prisma/schema.prisma
M  src/actions/bpm/Cadencias.ts
M  src/actions/bpm/Campos.ts
M  src/actions/bpm/ConfiguracaoPipeline.ts
M  src/actions/bpm/Etapas.ts
M  src/actions/bpm/FormulariosEtapa.ts
M  src/actions/bpm/Pipelines.ts
M  src/actions/bpm/Sla.ts
M  src/actions/bpm/SubStatus.ts
M  src/actions/bpm/Transicoes.ts
M  src/actions/bpm/VisibilidadeEtapas.ts
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/CadenciaEtapasSection.tsx
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/EtapaAvancadaSection.tsx
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigForm.tsx
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigSection.tsx
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadeEtapasSection.tsx
M  src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx
A  src/lib/bpm/config-version.ts
M  src/lib/bpm/pipeline-config-publicacao.ts
M  tests/bpm/cadencias-actions.test.ts
M  tests/bpm/campos-configuraveis-actions.test.ts
M  tests/bpm/configuracao-pipeline-confiavel.test.ts
A  tests/bpm/configuracao-pipeline-publicacao-action.test.ts
M  tests/bpm/formularios-etapa-save.test.ts
M  tests/bpm/pipeline-config-publicacao.test.ts
A  tests/bpm/pipeline-config-version-transaction.test.ts
M  tests/bpm/pipeline-config-workspace.test.ts
M  tests/bpm/pipelines-etapas-admin.test.ts
M  tests/bpm/visibilidade-etapa-actions.test.ts
```
