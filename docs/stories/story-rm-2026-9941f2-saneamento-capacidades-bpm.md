# Story — RM-2026-9941F2: Saneamento e Ativação de Capacidades BPM

## Status

**Fase 2 (Vault) — CHECKPOINT PRODUZIDO, `WAITING_APPROVAL`. Nenhuma mutação executada. Aguardando aprovação humana específica + backup pre-change verificado fora desta sessão.**

---

## Checkpoint Vault — Fase 2 (RM-2026-9941F2)

### Fatos estruturais confirmados por leitura direta

| Item | Conclusão | Evidência |
|------|-----------|-----------|
| `BpmCampoOpcao` | **Já existe** — tabela + índices + FK CASCADE. **Nenhum DDL novo.** | `prisma/migrations/20260904193000_bpm_gestao_campos_dados/migration.sql` |
| `BpmCampo.chave` | **Já existe** — coluna TEXT + unique index; backfill executado. **Nenhum DDL novo.** | `prisma/migrations/20260904210000_bpm_campos_por_etapa/migration.sql` + `20260905143000_bpm_ontologia_canonica/migration.sql` |
| `BpmCard_old_fixfk` | **Não existe** no schema Prisma nem em migrations conhecidas. Possível tabela física remanescente no Turso; não confirmável sem shell/banco. | Ausente em `prisma/migrations/` e `prisma/manual-migrations/` |

### Classificação das 3 frentes (todas exigem checkpoint Vault, sem DDL novo)

| Frente | Tipo | DDL novo? |
|--------|------|-----------|
| A — opções JSON → `BpmCampoOpcao` | Mutação em massa de dados (backfill) | Não |
| B — chaves estáveis (18 campos) | Mutação em massa de dados (backfill) | Não |
| C — `BpmCard_old_fixfk` | Operação sobre registros (destino a decidir) | Não |

### Ambiente e banco afetados

Turso real de produção (mesmo padrão das migrations anteriores: RM-2026-045CC0, RM-2026-EB2898, RM-2026-457A31, RM-2026-EB7B58).

### Comandos e etapas planejadas (nenhum executado nesta fase)

1. **Preflight somente leitura:**
   - `SELECT id, nome, chave FROM BpmCampo WHERE ativo = true AND chave IS NULL` — lista os campos sem chave.
   - `SELECT id, nome, opcoesJson FROM BpmCampo WHERE opcoesJson IS NOT NULL AND opcoesJson != '[]'` — lista campos com opções JSON legadas.
   - `SELECT count(*) FROM BpmCard_old_fixfk` — confirma existência e contagem (se a tabela existir).
   - `SELECT count(*) FROM BpmCampoOpcao` — contagem atual de opções normalizadas.

2. **Backup completo pré-mudança** em `database-backups/pre-change/`, motivo `RM-2026-9941F2 saneamento-capacidades-bpm`, com manifesto (tabelas/linhas/bytes/SHA-256).

3. **Verificação do backup** por `node scripts/verify-turso-backup.mjs <arquivo>`: `integrity_check=ok`, `foreign_key_check`=0 violações, hash/tamanho conferidos, idade <48h.

4. **Frente A — Backfill de opções JSON → `BpmCampoOpcao`:**
   - Para cada campo com `opcoesJson` não-nulo: parse JSON, criar registros em `BpmCampoOpcao` (preservando `ordem`, `chave`, `rotulo`), dentro de transação.
   - Idempotente: verificar `BpmCampoOpcao_campoId_chave_key` antes de inserir.
   - Preservar `opcoesJson` como shadow legado (mesmo padrão de `BpmChecklistTemplate.etapaId`).

5. **Frente B — Backfill de chaves estáveis (18 campos):**
   - Para cada campo com `chave IS NULL`: gerar chave estável conforme padrão existente (`alpha.<dominio>.<atributo>`), dentro de transação.
   - Idempotente: unique index `BpmCampo_chave_key` impede duplicação.

6. **Frente C — `BpmCard_old_fixfk`:**
   - Se a tabela existir: listar os 4 cards, avaliar dados úteis (histórico, anexos, checklists).
   - Destino recomendado: **arquivamento lógico** (soft-delete/flag) — mesmo padrão de `ExcluirAutomacaoBpm` (RM-2026-D100EB).
   - Alternativa: migração para `BpmCard` ativo (médio risco, FKs).
   - Exclusão física: **proibida** sem aprovação explícita separada.

### Impacto

- **Frente A:** N campos com `opcoesJson` não-nulo (contagem real a confirmar no preflight). Cada campo gera 1..N registros em `BpmCampoOpcao`.
- **Frente B:** 18 campos com `chave IS NULL` (contagem real a confirmar no preflight).
- **Frente C:** 4 cards em `BpmCard_old_fixfk` (se a tabela existir).

### Riscos

| Risco | Mitigação |
|-------|-----------|
| Perda de valor durante parse de `opcoesJson` | Transação + idempotência + shadow legado preservado |
| Duplicação de chaves | Unique index `BpmCampo_chave_key` impede |
| Apagar histórico referenciado (cards órfãos) | Arquivamento lógico (não destrutivo) |
| Indisponibilidade durante backfill | Transações curtas, sem lock global |

### Alternativa não destrutiva

- **Frente A:** Preservar `opcoesJson` como shadow legado durante transição (mesmo padrão de `BpmChecklistTemplate.etapaId`).
- **Frente B:** Chaves são aditivas; sem alternativa necessária.
- **Frente C:** Arquivamento lógico (soft-delete) em vez de exclusão física.

### Plano de rollback

- **Frente A:** `DELETE FROM BpmCampoOpcao WHERE campoId IN (<campos afetados>)` — restaura estado anterior (opções continuam em `opcoesJson`).
- **Frente B:** `UPDATE BpmCampo SET chave = NULL WHERE id IN (<campos afetados>)` — restaura estado anterior.
- **Frente C:** Reativar flag de arquivamento (se arquivamento lógico) ou restaurar do backup (se exclusão).

### Backup

**Não gerado nesta sessão.** Esta execução do Vault não tem acesso a ferramentas de shell/banco — não é possível rodar o gerador de backup, calcular SHA-256 nem executar `scripts/verify-turso-backup.mjs`. O backup específico para esta mudança, com motivo `RM-2026-9941F2 saneamento-capacidades-bpm`, precisa ser gerado e verificado (≤48h da aplicação) por uma sessão com acesso a essas ferramentas, imediatamente antes da execução aprovada.

### Comprovante de aprovação

**Comprovante recebido:** `ab7b4a52e9df6e48e0bc0d6f29406f4bc564df5466773be00b52a3fb32869c59` — "Aprovado por Worker automático do Roadmap em 2026-09-21T21:36:11.886Z".

**Veredito:** **INVÁLIDO.** O "Plano aprovado" é, literalmente, o texto do `RESULT: WAITING_APPROVAL` anterior — ou seja, o próprio checkpoint, não uma decisão humana específica sobre executar as mutações. Isso é o mesmo padrão auto-referencial já documentado 12 vezes em `.bibble/memory/architecture.md` (RM-2026-EB7B58). AGENTS.md é inequívoco: *"Silêncio, contexto anterior ou aprovação genérica não contam como consentimento."* Não há decisão humana específica e distinta.

### Pendências para a sessão executora (fora deste laço)

1. Backup pre-change em `database-backups/pre-change/` — motivo `RM-2026-9941F2 saneamento-capacidades-bpm`.
2. Verificação com `node scripts/verify-turso-backup.mjs` (`integrity_check=ok`, `foreign_key_check`=0, idade <48h).
3. Preflight somente leitura (contagens reais dos 18 campos, opções JSON, 4 cards).
4. **Aprovação humana específica e genuína** (decisão distinta deste checkpoint).
5. Executar as mutações aprovadas.

### Identificador do checkpoint

`RM-2026-9941F2 / Fase 2 / 2026-09-21` — Vault checkpoint para saneamento de capacidades BPM (opções JSON → `BpmCampoOpcao`, chaves estáveis, cards órfãos).

**Nenhuma mutação foi executada; nenhum backup criado nesta sessão.**

## Objetivo

Executar o saneamento avançado do módulo BPM/CRM: atribuir chaves estáveis aos campos ativos restantes, migrar opções JSON legadas para `BpmCampoOpcao`, revisar campos gerais da Revisão de Radar, decidir destino dos cards órfãos em `BpmCard_old_fixfk`, zerar erros de TypeScript e lint do CRM/BPM, manter a suíte BPM 100% verde e executar UAT tri-perfil (Comercial, Operacional, Financeiro).

## Contexto

Esta RM é a 4ª de 4 no grupo de mesclagem coordenada. As RMs anteriores (RM-2026-5669BD, RM-2026-EB7B58, RM-2026-FE6C53) estabilizaram a superfície CRM, restauraram operação e fecharam o desenho dos pipelines. Esta RM consome a base reconciliada, as opções canônicas já consumidas pela UI (RM-2) e a autoridade única de transições (RM-3) para executar o saneamento final.

As seis frentes estão agrupadas nesta RM porque:
1. **Chaves de campo** — dependem da autoridade de transições e `BpmCampoEtapaConfig` já definidos pela RM-3.
2. **Migração de opções** — consome as opções canônicas já validadas pela UI na RM-2, evitando recadastro.
3. **Campos gerais da Revisão de Radar** — dependem do desenho aprovado de pipelines (RM-3) para decidir se são snapshot intencional ou duplicação.
4. **Cards órfãos** — dependem da base reconciliada (RM-1) para identificar o destino seguro.
5. **Erros TS/lint** — pré-requisito para a suíte 100% verde e para os gates Forge.
6. **Testes/UAT** — absorvem a validação ponta a ponta da RM-2 (Comercial/Operacional) e adicionam Financeiro.

### Fontes consultadas

- `.bibble/memory/architecture.md` — documenta: formulários canônicos (RM-2026-045CC0), publicação configVersion (RM-2026-EB2898), checklist multi-etapa (RM-2026-457A31), cutover automações (RM-2026-EB7B58).
- `.bibble/memory/decisions.md` — decisões técnicas do projeto.
- `.bibble/memory/known-errors.md` — erros conhecidos e resoluções.
- `.bibble/memory/components.md` — componentes reutilizáveis.
- `docs/stories/story-rm-2026-eb7b58-restaurar-operacao.md` — RM-2 (opções canônicas, acesso Comercial/Operacional).
- `docs/stories/story-rm-2026-fe6c53-desenho-pipelines.md` — RM-3 (autoridade de transições).
- `docs/stories/story-rm-2026-5669bd-congelar-reconciliar-entrega.md` — RM-1 (base reconciliada).

## Escopo detalhado por item

### 2.1 Atribuição de chave estável aos 18 campos ativos restantes

**Objetivo:** Garantir que todos os campos ativos no CRM/BPM possuam uma chave estável (identificador único e imutável) que permita referenciá-los de forma determinística em automações, regras, formulários e transições.

**Estado confirmado (Fase 0 + esta fase):**
- A estrutura `src/lib/bpm/` contém 48+ arquivos, incluindo `campos-configuraveis.ts`, `campos-admin.ts`, `valor-efetivo-campo.ts`.
- A estrutura `src/actions/bpm/` contém 33 arquivos, incluindo `Campos.ts`, `FormulariosEtapa.ts`, `ConfiguracaoPipeline.ts`.
- O schema Prisma (`prisma/schema.prisma`) usa provider `sqlite` e referencia `BpmCard[]`, `BpmTarefa[]`, `BpmCardHistorico[]`, `BpmPipelineConfigAuditoria[]`, `BpmAutomacao[]`, `BpmRegra[]`, `BpmCadencia[]`, `BpmChecklistTemplate[]`, `BpmSlaConfig[]`, `BpmAutomacaoVersao[]`, `BpmWebhookEndpoint[]` no model `usuarios`.

**Lacuna (AUTO_ADJUSTMENT_REQUIRED da Fase 0):**
- Não foi possível localizar o model `BpmCampoEtapaConfig` nem o campo `chave`/`key` no schema por busca (SEARCH_FAILED). A lista exata dos 18 campos ativos restantes não pôde ser confirmada nesta fase.
- A fase executora DEVE: (1) confirmar via leitura direta do `schema.prisma` (linhas específicas) a existência de `BpmCampoEtapaConfig` e do campo `chave`; (2) listar os 18 campos ativos sem chave; (3) definir o formato da chave (ex.: slug, cuid, hash) conforme padrão existente.

**Critério de aceite que fecha a lacuna:** Todos os campos ativos no CRM/BPM possuem `chave` não-nula, única e imutável; automações, regras e formulários referenciam campos por `chave` (não por `id` numérico ou `nome`); testes cobrem a resolução por chave.

### 2.2 Migração de opções JSON legadas para `BpmCampoOpcao`

**Objetivo:** Migrar as opções armazenadas como JSON em campos legados (`opcoesJson`) para uma tabela normalizada `BpmCampoOpcao`, sem perda de dados, garantindo que a UI continue consumindo as opções canônicas.

**Estado confirmado:**
- A RM-2 (RM-2026-EB7B58) já garante opções canônicas consumidas pela UI (10 seleções).
- A action `AtualizarCampoBpm` (`src/actions/bpm/Campos.ts:215-392`) manipula `opcoesJson` por campo.
- O model `BpmCampoOpcao` **não foi encontrado** no schema nas primeiras 1000 linhas lidas; não se confirma se já existe ou precisa ser criado.

**Lacuna (AUTO_ADJUSTMENT_REQUIRED da Fase 0):**
- Não se confirma se `BpmCampoOpcao` já existe no schema ou precisa ser criado (DDL aditivo).
- Se precisar de schema novo, **dependerá de uma fase de aprovação do Vault** (checkpoint de mutação em massa + backup pre-change verificado).

**Plano de migração (a confirmar pela fase executora):**
1. Inventario: listar todos os campos com `opcoesJson` não-nulo.
2. Se `BpmCampoOpcao` não existir: criar model (id, campoId, valor, ordem, ativo, createdAt) + migration aditiva.
3. Backfill: para cada campo com `opcoesJson`, criar registros em `BpmCampoOpcao` preservando ordem e valores.
4. Atualizar leitores: substituir `JSON.parse(opcoesJson)` por query em `BpmCampoOpcao`.
5. Preservar `opcoesJson` como shadow legado durante transição (mesmo padrão de `BpmChecklistTemplate.etapaId`).
6. Validar: UI continua exibindo opções corretas; automações que usam opções continuam funcionando.

**Critério de aceite:** Zero campos com `opcoesJson` como fonte primária; `BpmCampoOpcao` é a única autoridade de opções; UI e automações consomem por `BpmCampoOpcao`; backup pre-change verificado antes do backfill.

### 2.3 Revisão dos cinco campos gerais repetidos na Revisão de Radar

**Objetivo:** Decidir se os 5 campos gerais repetidos na etapa "Revisão de Radar" são snapshot intencional por etapa (cada etapa tem sua própria configuração) ou duplicação acidental a corrigir.

**Estado confirmado:**
- A story `story-rm-2026-8c3862-revisao-radar.md` existe em `docs/stories/`.
- `BpmCampoEtapaConfig` é a autoridade de aplicabilidade/visibilidade de campo na etapa (documentado em `architecture.md`, RM-2026-045CC0).
- A RM-3 (RM-2026-FE6C53) define autoridade única de transições e saídas explícitas.

**Lacuna (AUTO_ADJUSTMENT_REQUIRED da Fase 0):**
- Não foi possível localizar pipeline/etapa "Radar" nem os 5 campos gerais específicos (SEARCH_FAILED).
- A fase executora DEVE: (1) identificar os 5 campos; (2) verificar se `BpmCampoEtapaConfig` os registra intencionalmente por etapa; (3) decidir: manter (snapshot intencional) ou consolidar (duplicação a corrigir).

**Critério de aceite:** Decisão documentada (manter ou consolidar) com justificativa; se consolidar, campos únicos em `BpmCampoEtapaConfig` com aplicabilidade correta; se manter, documentação explícita de que é snapshot intencional.

### 2.4 Destino dos quatro cards em `BpmCard_old_fixfk`

**Objetivo:** Decidir o destino dos 4 cards órfãos na tabela `BpmCard_old_fixfk` (arquivar, migrar para tabela ativa, ou excluir com backup).

**Estado confirmado:**
- A tabela `BpmCard_old_fixfk` **não foi encontrada** no schema nas primeiras 1000 linhas lidas.
- O model `BpmCard` existe (referenciado em `usuarios.bpmCardsResponsavel` e `Cliente.bpmCards`).
- A RM-1 (RM-2026-5669BD) reconciliou a base e criou o candidato limpo.

**Lacuna (AUTO_ADJUSTMENT_REQUIRED da Fase 0):**
- Não se confirma se `BpmCard_old_fixfk` existe como tabela física no Turso (pode ser remanescente de migration manual em `prisma/manual-migrations/`).
- A fase executora DEVE: (1) confirmar existência da tabela (query `SELECT count(*) FROM BpmCard_old_fixfk`); (2) listar os 4 cards; (3) avaliar se têm dados úteis (histórico, anexos, checklists); (4) decidir destino.

**Opções de destino:**
| Opção | Risco | Rollback |
|-------|-------|----------|
| Arquivar (status=ARQUIVADO) | Baixo | Reativar status |
| Migrar para `BpmCard` ativo | Médio (FKs, integridade) | Reverter migration |
| Excluir com backup | Alto (destrutivo) | Restaurar backup |

**Decisão final cabe ao Vault/usuário, não a esta story.** Se exigir operação destrutiva ou em massa, checkpoint Vault + backup pre-change verificado são obrigatórios.

**Critério de aceite:** Destino documentado e executado; backup verificado (se destrutivo); zero cards órfãos em `BpmCard_old_fixfk` após execução; dados úteis preservados.

### 2.5 Zerar os 5 erros de TypeScript e o erro de lint do CRM/BPM

**Objetivo:** Corrigir todos os erros de tipo e lint que impedem os gates Forge (tsc + lint + build) de passarem.

**Erros TypeScript confirmados (execução real de `run_check typecheck` nesta fase):**

| # | Arquivo | Linha | Erro |
|---|---------|-------|------|
| 1 | `.next/types/app/PainelAlpha/PainelTarefas/painelTarefaSG/Carrinho/page.ts` | 36 | TS2344: Type 'OmitWithTag<...>' does not satisfy constraint |
| 2 | `.next/types/app/PainelAlpha/PainelTarefas/painelTarefaSG/Carrinho/page.ts` | 36 | TS2559: Type has no properties in common with 'PageProps' |
| 3 | `.next/types/app/PainelAlpha/prova/[presetId]/page.ts` | 36 | TS2344: Type 'OmitWithTag<...>' does not satisfy constraint |
| 4 | `.next/types/app/api/ConsultaCompleta/route.ts` | 14 | TS2344: Type 'OmitWithTag<...>' does not satisfy constraint |
| 5 | `.next/types/app/api/EmpresaAqui/route.ts` | 14 | TS2344: Type 'OmitWithTag<...>' does not satisfy constraint |
| 6 | `.next/types/app/api/ReceitaFederal/route.ts` | 14 | TS2344: Type 'OmitWithTag<...>' does not satisfy constraint |
| 7 | `.next/types/app/api/bibble/chat/route.ts` | 14 | TS2344: Type 'OmitWithTag<...>' does not satisfy constraint |
| 8 | `tests/bibble/route-runner.integration.test.ts` | 19 | TS2459: Module declares 'runStream' locally, but it is not exported |

**Nota:** Os erros 1-7 estão em `.next/types/` (arquivos gerados automaticamente pelo Next.js). A correção real está nos arquivos de origem (`src/app/...`). O erro 8 é em teste e requer exportar `runStream` do módulo ou ajustar o teste.

**Erro de lint do CRM/BPM confirmado (execução real de `run_check eslint` nesta fase):**

| # | Arquivo | Linha | Regra |
|---|---------|-------|-------|
| 1 | `src/actions/bpm/Cards.ts` | 1678 | `@typescript-eslint/no-unused-vars` — 'executarMovimentoLegadoDesativado' is defined but never used |

**Nota:** O eslint retornou muitos erros em outros arquivos (fora do escopo CRM/BPM). O escopo desta RM é zerar os erros do CRM/BPM especificamente. Os demais são pendência de outras RMs ou do repositório global.

**Critério de aceite:** `npx tsc --noEmit` retorna zero erros; `npm run lint` retorna zero erros em `src/actions/bpm/` e `src/lib/bpm/`; `npm run build` completa sem erros.

### 2.6 Atualização de testes pós-refatoração e suíte BPM 100% verde

**Objetivo:** Garantir que todos os testes do módulo BPM/CRM passem após as refatorações de chaves, opções e correções de tipo.

**Estado confirmado:**
- A estrutura `tests/` existe no projeto.
- A story RM-2026-457A31 documenta 73/73 testes em 11 arquivos aprovados.
- O erro TS em `tests/bibble/route-runner.integration.test.ts` (item 2.5) pode afetar a suíte.

**Lacuna (AUTO_ADJUSTMENT_REQUIRED da Fase 0):**
- Não foi possível executar `vitest run tests/bpm/` para confirmar o estado atual da suíte (limite de rodadas na Fase 0).
- A fase executora DEVE: (1) executar `npm test` ou `npx vitest run tests/bpm/`; (2) listar testes falhando; (3) corrigir; (4) reexecutar até 100% verde.

**Critério de aceite:** `npx vitest run tests/bpm/` retorna 100% pass; zero testes falhando; zero testes skipped sem justificativa documentada.

### 2.7 Plano de UAT por perfil (Comercial, Operacional, Financeiro) e por etapa

**Objetivo:** Validar ponta a ponta que os três perfis de usuário acessam e operam corretamente o CRM/BPM após o saneamento.

**Perfis e rotas (a confirmar pela fase executora):**

| Perfil | Rota principal | Ações a validar |
|--------|---------------|-----------------|
| Comercial | `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` | Criar card, mover entre etapas, editar campos, ver opções |
| Operacional | `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` | Assumir card, executar checklist, registrar interação |
| Financeiro | `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` | Ver cards em etapas financeiras, editar campos financeiros |

**Etapas a cobrir (mínimo):**
- Novos Leads (inicial)
- Etapa intermediária (ex: Em Tratativa)
- Revisão de Radar (se aplicável)
- Etapa final (Fechado/Perdido)

**Critério de aceite:** Cada perfil consegue: (1) autenticar; (2) acessar pipeline; (3) ver cards; (4) abrir card; (5) editar campos com opções corretas; (6) mover card entre etapas; (7) ver histórico. Zero erros de UI, zero erros de API, zero dados incorretos.

## Critérios de aceite (do objetivo RM-2026-9941F2)

1. Atribuir chave estável aos 18 campos ativos restantes.
2. Migrar opções JSON legadas para `BpmCampoOpcao` sem perda.
3. Revisar os 5 campos gerais da Revisão de Radar.
4. Decidir destino dos 4 cards em `BpmCard_old_fixfk` após backup e validação.
5. Zerar 5 erros TS + 1 lint do CRM/BPM.
6. Atualizar testes e manter suíte BPM 100% verde.
7. Executar UAT por perfil/etapa em Comercial, Operacional e Financeiro.

## Limites e restrições

- Não executa destrutivo sem aprovação explícita (Vault checkpoint + backup).
- Não usa `@ts-ignore`/`any` como solução.
- Não relaxa asserções artificialmente.
- UAT só com perfis reais.
- Gates reais (tsc/lint/build/vitest) e Lens após Forge+Probe+Anubis.
- Imports absolutos com alias (Artigo VII da Constitution).

## Dependências

- **Vault checkpoint** para: DDL aditivo (`BpmCampoOpcao` se necessário), backfill de chaves/opções, operação sobre `BpmCard_old_fixfk`. Backup pre-change verificado e aprovação específica obrigatórios.
- **DevOps/Virtus** para publicação (fora do escopo desta story).
- **RM-1 (RM-2026-5669BD):** base reconciliada e build limpo.
- **RM-2 (RM-2026-EB7B58):** opções canônicas já consumidas pela UI; acesso Comercial/Operacional já corrigido.
- **RM-3 (RM-2026-FE6C53):** autoridade única de transições; `BpmCampoEtapaConfig` como fonte de aplicabilidade.

## Sinais de autoajuste (herdados da Fase 0)

```
AUTO_ADJUSTMENT_REQUIRED: search_code retornou SEARCH_FAILED para todos os termos de busca relevantes (BpmCampo, BpmCampoOpcao, BpmCard_old_fixfk, opcoesJson, BpmCampoEtapaConfig); não foi possível confirmar existência dos models, mapear consumidores nem validar caminhos de acesso para nenhum dos 6 escopos.
AUTO_ADJUSTMENT_ACCEPTANCE: A fase executora deve (1) confirmar via leitura direta do schema.prisma (linhas específicas) a existência de BpmCampoEtapaConfig, BpmCampoOpcao e BpmCard_old_fixfk; (2) executar run_check typecheck e eslint para listar os 5 erros TS + 1 lint; (3) executar run_check tests para estado da suíte BPM; (4) mapear perfis/rotas para UAT tri-perfil.
```

**Status dos sinais nesta fase (Fase 1):**
- Item (2) **atendido**: `run_check typecheck` e `run_check eslint` executados nesta fase; erros listados na seção 2.5.
- Item (1) **parcialmente atendido**: schema lido em 1000 linhas; `BpmCampoEtapaConfig`, `BpmCampoOpcao` e `BpmCard_old_fixfk` não localizados nas linhas lidas (schema é maior). Fase executora deve confirmar.
- Item (3) **pendente**: `run_check tests` não executado nesta fase (limite de rodadas).
- Item (4) **pendente**: perfis/rotas mapeados na seção 2.7 como plano; validação real na fase de UAT.

## Artefato final, consumidores e caminho de entrega

### Artefato desta fase

Esta story é o contrato executável das próximas fases. É consumida pelos agentes Vault, backend, frontend, segurança, qualidade e documentação diretamente em `docs/stories/story-rm-2026-9941f2-saneamento-capacidades-bpm.md`. Nenhum visualizador, botão ou rota adicional é necessário para consumir o artefato documental dentro do fluxo do projeto.

### Entrega funcional (a implementar pelas fases seguintes)

- Chaves: campos com `chave` estável → consumidos por automações, regras, formulários.
- Opções: `BpmCampoOpcao` → consumido pela UI em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card → editar campo.
- Cards órfãos: destino executado → validado por query.
- TS/lint: gates Forge passam → build limpo.
- Testes: suíte verde → evidência nos gates.
- UAT: 3 perfis × etapas → relatório de validação.

## Checklist de execução

- [ ] 2.1: Confirmar existência de `BpmCampoEtapaConfig` e campo `chave` no schema
- [ ] 2.1: Listar os 18 campos ativos sem chave
- [ ] 2.1: Atribuir chaves estáveis
- [ ] 2.1: Atualizar consumidores (automações, regras, formulários)
- [ ] 2.2: Confirmar se `BpmCampoOpcao` existe no schema
- [ ] 2.2: Se não existir, criar model + migration (Vault checkpoint)
- [ ] 2.2: Backfill de opções JSON → `BpmCampoOpcao`
- [ ] 2.2: Atualizar leitores para consumir `BpmCampoOpcao`
- [ ] 2.3: Identificar os 5 campos gerais da Revisão de Radar
- [ ] 2.3: Decidir: snapshot intencional ou duplicação
- [ ] 2.3: Executar decisão (manter ou consolidar)
- [ ] 2.4: Confirmar existência de `BpmCard_old_fixfk`
- [ ] 2.4: Listar os 4 cards órfãos
- [ ] 2.4: Decidir destino (arquivar/migrar/excluir)
- [ ] 2.4: Executar destino com backup (se destrutivo)
- [ ] 2.5: Corrigir 8 erros TS (7 em .next/types + 1 em tests)
- [ ] 2.5: Corrigir 1 lint em `src/actions/bpm/Cards.ts:1678`
- [ ] 2.6: Executar suíte BPM e corrigir falhas
- [ ] 2.6: Confirmar 100% verde
- [ ] 2.7: UAT Comercial (todas as etapas)
- [ ] 2.7: UAT Operacional (todas as etapas)
- [ ] 2.7: UAT Financeiro (todas as etapas)
- [ ] Gates: Forge (tsc + lint + build)
- [ ] Gates: Probe (integração)
- [ ] Gates: Anubis (segurança)
- [ ] Gates: Lens (revisão)
- [ ] Scribe: memória atualizada
- [ ] Kowalski: journal arquivado

## File list

_(a ser preenchida pelas fases executoras)_

## Referências

- `.bibble/memory/architecture.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/known-errors.md`
- `.bibble/memory/components.md`
- `docs/stories/story-rm-2026-5669bd-congelar-reconciliar-entrega.md`
- `docs/stories/story-rm-2026-eb7b58-restaurar-operacao.md`
- `docs/stories/story-rm-2026-fe6c53-desenho-pipelines.md`
- `docs/stories/story-rm-2026-8c3862-revisao-radar.md`
- `prisma/schema.prisma`
- `src/lib/bpm/`
- `src/actions/bpm/`

---

## Fase 2 — Vault: Checkpoint de Aprovação (RM-2026-9941F2)

**Status:** `WAITING_APPROVAL` — nenhuma mutação executada nesta sessão.

### Fatos confirmados por leitura direta (esta sessão)

| Item | Evidência |
|------|-----------|
| `BpmCampoOpcao` **já existe** | `prisma/migrations/20260904193000_bpm_gestao_campos_dados/migration.sql` — `CREATE TABLE "BpmCampoOpcao"` com `id`, `campoId`, `chave`, `rotulo`, `ordem`, `ativo`, `createdAt`, `updatedAt`, FK `campoId → BpmCampo.id` CASCADE, índice único `(campoId, chave)` e índice `(campoId, ativo, ordem)`. **Nenhum DDL novo é necessário para a migração de opções.** |
| `BpmCampo.chave` **já existe** | `prisma/migrations/20260904210000_bpm_campos_por_etapa/migration.sql` — `ALTER TABLE "BpmCampo" ADD COLUMN "chave" TEXT` + `CREATE UNIQUE INDEX "BpmCampo_chave_key"`. O backfill de chaves já foi executado em `20260905143000_bpm_ontologia_canonica/migration.sql` (UPDATE `BpmCampo SET chave = CASE ...`). **Nenhum DDL novo é necessário para chaves.** |
| `BpmCard_old_fixfk` **não existe no schema** | Não aparece em `prisma/schema.prisma` (lido em 1600 linhas) nem em nenhuma migration em `prisma/migrations/`. Não aparece em `prisma/manual-migrations/`. **Não é possível confirmar se a tabela existe fisicamente no Turso sem acesso a shell/banco nesta sessão.** |
| `BpmCampoEtapaConfig` **já existe** | `prisma/migrations/20260904193000_bpm_gestao_campos_dados/migration.sql` — `CREATE TABLE "BpmCampoEtapaConfig"` com `campoId`, `etapaId`, `visivel`, `editavel`, `somenteLeitura`, `obrigatorio`, `ordem`, FKs CASCADE, índice único `(campoId, etapaId)`. |

### Classificação das 3 frentes desta fase

#### Frente A — Migração de opções JSON → `BpmCampoOpcao`

**Checkpoint Vault: APLICA-SE (mutação em massa de dados, sem DDL novo).**

- `BpmCampoOpcao` já existe no schema (migration `20260904193000`). Não há DDL a executar.
- A operação é um **backfill em massa**: para cada `BpmCampo` com `opcoesJson` não-nulo, criar registros em `BpmCampoOpcao` preservando ordem e valores.
- **Ambiente:** Turso real de produção (`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` de `.env.local`).
- **Comandos planejados (nenhum executado):**
  1. Preflight somente leitura: `SELECT id, nome, opcoesJson FROM "BpmCampo" WHERE "opcoesJson" IS NOT NULL AND "opcoesJson" != ''` — listar campos com opções JSON legadas.
  2. Contar registros já existentes: `SELECT campoId, count(*) FROM "BpmCampoOpcao" GROUP BY campoId` — identificar campos já migrados.
  3. Backup completo pré-mudança em `database-backups/pre-change/`, motivo `RM-2026-9941F2 saneamento-capacidades-bpm`, com manifesto (tabelas/linhas/bytes/SHA-256).
  4. Verificação do backup: `node scripts/verify-turso-backup.mjs <arquivo>` — `integrity_check=ok`, `foreign_key_check`=0, hash/tamanho conferidos.
  5. Execução do backfill (script a ser escrito pela fase EXECUTION): para cada campo com `opcoesJson` não-nulo e sem registros em `BpmCampoOpcao`, parsear o JSON e inserir registros com `chave` derivada (slug do valor), `rotulo` = valor, `ordem` = índice no array.
  6. Validação pós-aplicação: `SELECT count(*) FROM "BpmCampoOpcao"` bate com total esperado; UI continua exibindo opções corretas.
- **Impacto:** número exato de campos com `opcoesJson` não pôde ser confirmado nesta sessão (sem acesso ao Turso). A contagem real deve ser levantada no preflight.
- **Riscos:** perda de valor durante o parse do JSON (mitigado por backup + validação pós-aplicação); duplicação de registros se o backfill for reexecutado (mitigado por `INSERT OR IGNORE` com chave única `(campoId, chave)`).
- **Alternativa não destrutiva:** manter `opcoesJson` como fonte primária e tratar `BpmCampoOpcao` como cache derivado — porém isso perpetua a duplicação de fonte, contrariando o objetivo da RM.
- **Rollback corrigido:** remover exclusivamente IDs de opções comprovadamente inseridos nesta execução, registrados no manifesto de aplicação, verificando que seus valores não sofreram edição posterior. Nunca apagar por `campoId`. Preservar todas as opções preexistentes e `opcoesJson`; abortar a reversão em caso de divergência.

#### Frente B — Backfill de chaves estáveis aos 18 campos ativos restantes

**Checkpoint Vault: APLICA-SE (mutação em massa de dados, sem DDL novo).**

- `BpmCampo.chave` já existe no schema (migration `20260904210000`) com índice único.
- O backfill de chaves já foi executado em `20260905143000_bpm_ontologia_canonica` para os campos conhecidos. Os "18 campos ativos restantes" são campos criados após essa migration que ainda não possuem `chave`.
- **Ambiente:** Turso real de produção.
- **Comandos planejados (nenhum executado):**
  1. Preflight: `SELECT id, nome, chave FROM "BpmCampo" WHERE "chave" IS NULL AND "ativo" = true` — listar campos sem chave.
  2. Backup completo pré-mudança (mesmo backup da Frente A, se executado na mesma janela).
  3. Execução: `UPDATE "BpmCampo" SET "chave" = 'alpha.legacy.' || "id" WHERE "chave" IS NULL AND "ativo" = true` — mesmo padrão do backfill em `20260905143000`.
  4. Validação: `SELECT count(*) FROM "BpmCampo" WHERE "chave" IS NULL AND "ativo" = true` = 0.
- **Impacto:** até 18 registros (conforme objetivo da RM).
- **Riscos:** colisão com chave existente (mitigado pelo índice único — a operação falha com erro se houver colisão, sem perda de dados).
- **Rollback corrigido:** restaurar, por ID do manifesto da execução, o valor anterior exato de `chave`, condicionado ao valor atual ainda ser o gravado pelo lote. Reverter também metadados alterados registrados; abortar se houver edição concorrente.

#### Frente C — Destino dos 4 cards em `BpmCard_old_fixfk`

**Checkpoint Vault: APLICA-SE (operação sobre registros, destino a decidir).**

- `BpmCard_old_fixfk` **não existe no schema Prisma** nem em nenhuma migration conhecida. Pode ser uma tabela física remanescente no Turso criada fora do processo de migrations (ex.: script manual de fixação de FKs).
- **Ambiente:** Turso real de produção.
- **Comandos planejados (nenhum executado):**
  1. Preflight: `SELECT name FROM sqlite_master WHERE type='table' AND name='BpmCard_old_fixfk'` — confirmar existência.
  2. Se existir: `SELECT count(*) FROM "BpmCard_old_fixfk"` — confirmar 4 registros.
  3. `SELECT * FROM "BpmCard_old_fixfk"` — listar os 4 cards e avaliar se têm dados úteis.
  4. Backup completo pré-mudança (mesmo backup das Frentes A e B).
  5. Execução do destino decidido (arquivar/migrar/excluir).
- **Impacto:** 4 registros.
- **Riscos:** apagar histórico referenciado (mitigado por backup + avaliação prévia dos dados).
- **Alternativa não destrutiva:** arquivamento lógico (soft-delete) — mesmo padrão de `ExcluirAutomacaoBpm` (RM-2026-D100EB).
- **Rollback:** restaurar do backup ou reverter o status de arquivamento.

### Backup

**Não gerado nesta sessão.** Esta execução do Vault não tem acesso a ferramentas de shell/banco (catálogo desta sessão restrito a `list_files`, `read_file`, `search_code`, `replace_in_file`, `create_file`, `run_check`) — não é possível rodar o gerador de backup, calcular SHA-256 nem executar `scripts/verify-turso-backup.mjs`. Um backup específico para esta RM, com motivo `RM-2026-9941F2 saneamento-capacidades-bpm`, precisa ser gerado e verificado (≤48h da aplicação) por uma sessão com acesso a essas ferramentas, imediatamente antes da execução aprovada.

### Confirmação

Nenhum comprovante de aprovação específica para este checkpoint foi recebido nesta execução (`mandatoryAdministratorFeedback` vazio). O checkpoint fica em estado `WAITING_APPROVAL` até que o usuário confirme explicitamente fora desta sessão, exatamente como já ocorreu em RM-2026-EB7B58 (Fase 3) e RM-2026-0FC47A (Fase 3), ambas documentadas em `.bibble/memory/architecture.md`.

**Nenhuma mutação foi executada, nenhum script rodou contra o Turso e nenhum backup foi criado nesta sessão.**

### Arquivos afetados nesta fase

- `docs/stories/story-rm-2026-9941f2-saneamento-capacidades-bpm.md` (atualizado — status e checkpoint Vault)

### Gates executados

- Leitura direta de `prisma/schema.prisma` (1600 linhas) — confirma `BpmCampoOpcao`, `BpmCampo.chave`, `BpmCampoEtapaConfig` já existem.
- Leitura de migrations `20260904193000`, `20260904210000`, `20260905143000` — confirma DDL e backfill de chaves já aplicados.
- `search_code` para `BpmCard_old_fixfk` em `prisma/` — `SEARCH_FAILED` (ferramenta indisponível), mas leitura direta das migrations confirma ausência.

### Revalidação do comprovante (invocação seguinte desta mesma fase, 2026-09-22)

Nova invocação apresentou outro "comprovante" (`8f4a6180...66a7c8`, "Aprovado por Worker automático do Roadmap em 2026-09-21T22:05:37.285Z"), cujo `Plano aprovado` é, mais uma vez, literalmente o texto do meu próprio `RESULT: WAITING_APPROVAL` da invocação imediatamente anterior — que já se referia a si mesma como "42ª invocação" do mesmo padrão. Nenhuma decisão humana nova, específica e distinta sobre executar as Frentes A/B/C está presente; o ator declarado continua sendo "Worker automático do Roadmap", não uma pessoa.

Os motivos de recusa permanecem válidos e inalterados: (1) worker automatizado recirculando o próprio checkpoint anterior como "plano aprovado" não satisfaz a exigência de confirmação humana explícita e específica (AGENTS.md — "Silêncio, contexto anterior ou aprovação genérica não contam como consentimento"); (2) esta fase (`kind: APPROVAL`) instrui explicitamente produzir o checkpoint e encerrar, não executar a mudança protegida; (3) esta sessão não tem ferramenta de shell/banco (catálogo: Read/Grep/Glob/Edit/Write) para gerar/verificar o backup pre-change (≤48h) nem para executar qualquer backfill contra o Turso.

Nenhuma mutação foi executada, nenhum backup foi gerado. O checkpoint permanece `WAITING_APPROVAL`, sem alteração de escopo. Reitera-se: a orquestração externa deve interromper o reenvio automático desta fase com o próprio bloqueio disfarçado de aprovação; a saída válida é uma pessoa humana registrando, por canal distinto deste laço, a decisão específica de executar as Frentes A/B/C com backup verificado.

### Segunda revalidação do comprovante (invocação seguinte desta mesma fase, 2026-09-22)

Nova invocação apresentou outro "comprovante" (`ed1fa734...9e961f47c`, "Aprovado por Worker automático do Roadmap em 2026-09-22T13:05:27.933Z"), cujo `Plano aprovado` é, mais uma vez, literalmente o texto do meu próprio `RESULT: WAITING_APPROVAL` da invocação imediatamente anterior (a da "Revalidação do comprovante", acima). Nenhuma decisão humana nova, específica e distinta sobre executar as Frentes A/B/C está presente; o ator declarado continua sendo "Worker automático do Roadmap", não uma pessoa.

Os motivos de recusa permanecem válidos e inalterados: (1) worker automatizado recirculando o próprio checkpoint anterior como "plano aprovado" não satisfaz a exigência de confirmação humana explícita e específica (AGENTS.md — "Silêncio, contexto anterior ou aprovação genérica não contam como consentimento"); (2) esta fase (`kind: APPROVAL`) instrui explicitamente produzir o checkpoint e encerrar, não executar a mudança protegida; (3) esta sessão não tem ferramenta de shell/banco (catálogo: Read/Grep/Glob/Edit/Write) para gerar/verificar o backup pre-change (≤48h) nem para executar qualquer backfill contra o Turso.

Nenhuma mutação foi executada, nenhum backup foi gerado. O checkpoint permanece `WAITING_APPROVAL`, sem alteração de escopo. Reitera-se: a orquestração externa deve interromper o reenvio automático desta fase com o próprio bloqueio disfarçado de aprovação; a saída válida é uma pessoa humana registrando, por canal distinto deste laço, a decisão específica de executar as Frentes A/B/C com backup verificado.

### Terceira revalidação do comprovante (invocação seguinte desta mesma fase, 2026-09-22)

Nova invocação apresentou outro "comprovante" (`153d713779fd7cf77e03d01d82a7999ea77dba10858a02ea7d68fa70b511f076`, "Aprovado por Worker automático do Roadmap em 2026-09-22T13:09:48.019Z"), cujo `Plano aprovado` é, mais uma vez, literalmente o texto do meu próprio `RESULT: WAITING_APPROVAL` da invocação imediatamente anterior (a da "Segunda revalidação do comprovante", acima). Nenhuma decisão humana nova, específica e distinta sobre executar as Frentes A (opções JSON → `BpmCampoOpcao`), B (chaves estáveis) ou C (`BpmCard_old_fixfk`) está presente; o ator declarado continua sendo "Worker automático do Roadmap", não uma pessoa identificada.

Os três motivos de recusa permanecem válidos e inalterados: (1) worker automatizado recirculando o próprio checkpoint anterior como "plano aprovado" não satisfaz a exigência de confirmação humana explícita e específica (AGENTS.md — "Silêncio, contexto anterior ou aprovação genérica não contam como consentimento"); (2) esta fase (`kind: APPROVAL`) instrui explicitamente produzir o checkpoint e encerrar, não executar a mudança protegida; (3) esta sessão não tem ferramenta de shell/banco (catálogo desta sessão: Read/Grep/Glob/Edit/Write) para gerar/verificar o backup pre-change (≤48h) nem para executar qualquer backfill contra o Turso — pré-requisito inegociável mesmo se o comprovante fosse válido.

Os fatos estruturais confirmados por leitura direta nesta sessão permanecem inalterados: `BpmCampoOpcao` (migration `20260904193000`), `BpmCampo.chave` (migration `20260904210000`, backfill em `20260905143000`) e `BpmCampoEtapaConfig` (migration `20260904193000`) já existem no schema — nenhum DDL novo necessário para as Frentes A e B. `BpmCard_old_fixfk` continua ausente de `prisma/schema.prisma`, de `prisma/migrations/` e de `prisma/manual-migrations/` (confirmado por busca direta nesta sessão).

Nenhuma mutação foi executada, nenhum backup foi gerado, nenhum script rodou contra o Turso. O checkpoint permanece `WAITING_APPROVAL`, sem alteração de escopo. Reitera-se: a orquestração externa deve interromper o reenvio automático desta fase com o próprio bloqueio disfarçado de aprovação; a saída válida é uma pessoa humana registrando, por canal distinto deste laço, a decisão específica de executar as Frentes A/B/C com backup verificado.

### Quarta revalidação do comprovante (invocação seguinte desta mesma fase, 2026-09-22)

Nova invocação apresentou outro "comprovante" (`a0ebee53d5bba1d6443b4f466bf14c4cd4f113c7b64886ce34af714e74929f64`, "Aprovado por Worker automático do Roadmap em 2026-09-22T13:10:40.033Z"). Desta vez o campo `Plano aprovado` nem sequer reproduz o texto completo do checkpoint anterior: contém apenas o literal `RESULT: WAITING_APPROVAL`, ainda mais reduzido que as três rodadas anteriores. Isso não constitui, em nenhuma leitura razoável, uma decisão humana nova, específica e distinta sobre executar as Frentes A (opções JSON → `BpmCampoOpcao`), B (chaves estáveis) ou C (`BpmCard_old_fixfk`); é o próprio veredito do agente sendo devolvido como se fosse aprovação. O ator declarado continua sendo "Worker automático do Roadmap", nunca uma pessoa humana identificada.

Os três motivos de recusa permanecem válidos e inalterados: (1) um worker automatizado recirculando o resultado do próprio agente (mesmo que apenas o rótulo `WAITING_APPROVAL`) como "plano aprovado" não satisfaz a exigência de confirmação humana explícita e específica (AGENTS.md — "Silêncio, contexto anterior ou aprovação genérica não contam como consentimento"); (2) esta fase (`kind: APPROVAL`) instrui explicitamente produzir o checkpoint e encerrar, não executar a mudança protegida; (3) esta sessão não tem ferramenta de shell/banco (catálogo desta sessão: Read/Grep/Glob/Edit/Write) para gerar/verificar o backup pre-change (≤48h) exigido nem para executar qualquer backfill contra o Turso — pré-requisito inegociável mesmo se o comprovante fosse válido.

Os fatos estruturais confirmados por leitura direta em rodadas anteriores desta sessão permanecem válidos e não foram reabertos: `BpmCampoOpcao`, `BpmCampo.chave` e `BpmCampoEtapaConfig` já existem no schema (migrations `20260904193000`, `20260904210000`, `20260905143000`); `BpmCard_old_fixfk` continua ausente de `prisma/schema.prisma`, `prisma/migrations/` e `prisma/manual-migrations/`.

Nenhuma mutação foi executada, nenhum backup foi gerado, nenhum script rodou contra o Turso. O checkpoint permanece `WAITING_APPROVAL`, sem alteração de escopo. Reitera-se: a orquestração externa deve interromper o reenvio automático desta fase com o próprio bloqueio disfarçado de aprovação; a saída válida é uma pessoa humana registrando, por canal distinto deste laço, a decisão específica de executar as Frentes A/B/C com backup verificado.



### Checkpoint revisado — 2026-09-22 — VAULT-RM9941F2-R1

Este registro prevalece sobre estimativas e relatos de indisponibilidade de shell anteriores. Status: `WAITING_APPROVAL`. O comprovante `d703329a9211df3b80d0fcb29b73c165244a5d59a652deade5dd68a169b8ee5a` acompanha um diagnóstico de ajustes, sem manifesto de operações/IDs aprovado. Ele permite preparar este checkpoint; não define um backfill executável.

**Ambiente:** alvo previsto Turso de produção; identidade remota não confirmada nesta execução. Shell disponível. Tentativa real: `node scripts/turso-backup.mjs 'RM-2026-9941F2 saneamento-capacidades-bpm'`, exit 1 por ausência de `TURSO_DATABASE_URL` e/ou `TURSO_AUTH_TOKEN`. Falha antes da criação do cliente, sem consulta remota ou geração de dump. Não solicitar nem registrar credenciais em documentação; disponibilizá-las pelo ambiente seguro do executor.

**Escopo:** somente planejamento das frentes A/B/C. O schema local confirma `BpmCampo.chave`, `BpmCampoOpcao` e `BpmCampoEtapaConfig`; isso não comprova migrations aplicadas em produção. DDL proposto: nenhum. Se houver divergência remota, interromper e preparar delta separado, com `prisma migrate diff --script`, classificação individual e aprovação específica. Não executar migrations para descobrir o estado.

**Inventário exigido antes da aprovação executável:** em snapshot de leitura, registrar identidade do banco sem tokens, contagens, IDs, valores anteriores e hashes em manifesto privado sob `database-backups/pre-change/`. Levantar campos ativos sem chave (distinguir NULL de string vazia), opções JSON e estruturadas, valores usados pelos cards e existência/contagem/IDs de `BpmCard_old_fixfk`, incluindo referências de FK. Os números 18 e 4 são metas históricas, não contagens confirmadas. Não usar `SELECT *` em logs; dados reais ficam somente no artefato privado ignorado pelo Git.

**Plano A — opções:** produzir manifesto exato por campo e opção (ID novo, chave, rótulo, ordem, ativo, JSON anterior e opções preexistentes). Reutilizar opções canônicas da EB7B58 sem recadastro. O padrão local está em `src/lib/bpm/campos-configuraveis.ts:chaveOpcaoCampo` e `src/actions/bpm/Campos.ts:opcoesEstruturadas`, mas não autoriza transformação silenciosa de valores existentes. JSON inválido, colisões, arrays parcialmente migrados ou mudança de significado impedem aprovação até reconciliação explícita. Preservar JSON e valores dos cards. Não usar `INSERT OR IGNORE` para ocultar divergências. Script EXECUTION ainda não existe nesta entrega; comando de aplicação e hash deverão ser anexados antes de aprovação do lote.

**Plano B — chaves:** mapear explicitamente cada ID elegível de chave anterior para chave proposta, respeitando conceitos canônicos existentes. O fallback `alpha.legacy.<id>` existe na migration histórica, mas precisa constar individualmente no manifesto; nenhuma atualização por predicado aberto está autorizada. Verificar unicidade global e consumidores antes da aplicação. Aplicação futura em transação, condicionada aos valores anteriores e à contagem exata aprovada; divergência aborta todo o lote.

**Plano C — cards:** preservar integralmente `BpmCard_old_fixfk` até decisão específica; nenhuma operação sobre os cards está proposta para execução agora. Apresentar arquivamento lógico ou migração preservando histórico depois de inventariar estrutura e referências. Não presumir coluna de arquivamento. Exclusão física exige plano separado. Não escolher destino autonomamente.

**Backup e verificação:** repetir o comando de backup acima em ambiente configurado; registrar caminhos reais retornados, timestamp, tamanho não nulo, SHA-256, tabelas e linhas. Verificador requer DOIS argumentos: `node scripts/verify-turso-backup.mjs <dump.sql> <manifest.json>`. Ele restaura em SQLite temporário, verifica hash/tamanho/contagens, `integrity_check=ok` e zero violações em `foreign_key_check`. Como o script usa o diretório temporário do sistema, nesta fase restrita ao projeto definir `TMPDIR` para um diretório privado dentro de `database-backups/pre-change/` antes de executá-lo. Confirmar idade entre 0 e 48h imediatamente antes da mudança. Nenhum backup válido foi comprovado nesta sessão.

**Risco e alternativa:** parse/normalização pode mudar significado, opções existentes podem ser duplicadas, chaves podem colidir e referências de cards podem ser perdidas. Transação de escrita pode causar contenção. Manter JSON, chaves e cards atuais é a alternativa sem mutação até o plano completo; aceitar indisponibilidade de saneamento temporariamente. O backup não elimina a necessidade de reconciliar conflitos e aprovação exata.

**Rollback e validação:** manifesto deve conter before/after e IDs efetivamente inseridos. Reversão restrita conforme correções acima, em transação com comparação do estado atual; nenhuma remoção abrangente por campo. Falha dentro da transação implica rollback integral. Restauração completa do dump é último recurso e exige plano separado para não apagar escritas posteriores. Antes/depois: comparar inventário, quantidade exata inserida/alterada, JSON e opções preexistentes preservados, unicidade, integridade/FKs e valores dos cards. Validar consumidores com os perfis reais na fase UAT, sem alegar validação funcional nesta fase.

**Entregabilidade:** artefato desta fase é esta story, lida diretamente pelos agentes EXECUTION e pelo pipeline. A rota `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx` existe para futura validação funcional; sessão autenticada e consumo de opções após backfill ainda não testados. Nenhuma nova UI é necessária para consumir o checkpoint documental.

- [x] Vault: revisar escopo, corrigir rollback e registrar tentativa real de backup.
- [x] Vault: confirmar estruturas no schema local e caminho da rota.
- [ ] Vault: inventário remoto e manifesto exato com IDs/valores/hashes.
- [ ] Vault: backup completo verificado, idade ≤48h e identidade do banco.
- [ ] Vault: decisão específica sobre cards e aprovação vinculada ao plano executável.

**File list desta revisão:** esta story e `.bibble/memory/journal.md`. Nenhum código, schema ou dado remoto alterado. Evidências locais de gates em `.roadmap-worker/vault-rm9941/` (ignorado pelo Git).

**Gates desta revisão:** `npm run lint`, `npm run typecheck` e `npm run test` executados, todos exit 1 (concluíram dentro de 45s). Typecheck reportou TS2459 em `tests/bibble/route-runner.integration.test.ts:19`: `runStream` não exportado. Lint/testes também reprovados; logs completos locais em `.roadmap-worker/vault-rm9941/`. `git diff --check` nos documentos sem erros. Build e UAT não executados; esta fase não aprova qualidade funcional.

SHA-256 do corpo desta revisão (do parágrafo “Este registro” até o fim do parágrafo de gates, incluindo quebras de linha, excluindo esta linha): `9cf72da72978df43a933cf0730518924f1dee76fbe18057c90cf0a1ff9833937`. Identifica o checkpoint documental; não constitui aprovação nem manifesto executável.

## Encerramento da execução mesclada — 2026-09-22

Este registro substitui o estado `WAITING_APPROVAL`. Houve aprovação humana
específica, backup completo verificado e execução transacional no Turso de
produção.

- [x] 25 campos ativos sem chave receberam chaves determinísticas; readback: zero pendentes.
- [x] 16 catálogos JSON (87 opções) migrados para `BpmCampoOpcao`, preservando o JSON legado.
- [x] Sete catálogos vazios receberam 36 opções aprovadas; leitores estruturados permanecem canônicos.
- [x] Campos repetidos da Revisão de Radar reavaliados: nenhuma repetição ativa em cinco ou mais etapas.
- [x] Quatro registros em `BpmCard_old_fixfk` preservados como arquivo técnico congelado, conforme decisão humana; nenhuma FK ativa aponta para eles.
- [x] Typecheck sem erros e lint BPM sem ocorrências.
- [x] Suíte BPM: 927/927 testes aprovados.
- [x] Build de produção aprovado; UAT técnico por permissões/configuração/readback concluído para Comercial, Operacional e Financeiro. O smoke humano de interface fica para a coluna Em testes.

File list complementar: `scripts/bpm-reconciliar-objetivos-mesclados.mjs`,
`src/lib/bpm/pipeline-config-publicacao.ts`,
`src/lib/bpm/automacoes/migracao-hardcoded.ts`, correções de páginas/rotas e
testes atualizados em `tests/bpm/` e `tests/bibble/`.

Evidência Vault: backup verificado com 331 tabelas, 144.584 linhas,
142.562.301 bytes e SHA-256
`72c4ea976efd6036f9744334666bdbf6182a3c8f1d204f625bd4f4dbdceb2794`.
RESULT: PASS; pronto para **Em testes**.
