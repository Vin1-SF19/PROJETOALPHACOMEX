# P0-1 — CRM-CONFIG-CANONICAL-SOURCES

Data da consolidação: 2026-09-09
Branch isolada: `feat/crm-config-canonical-sources`
Worktree: `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/crm-config-canonical-sources`

## Resultado

A configuração operacional do CRM/BPM passou a usar uma fonte canônica por domínio:

| Domínio | Fonte canônica ativa | Legado preservado somente como histórico |
|---|---|---|
| Transições | `BpmTransicaoEtapa` | `BpmEtapaTransicaoPermitida` |
| Campo por etapa | `BpmCampoEtapaConfig` | `BpmCampoObrigatorioEtapa`, `BpmCampoOcultoEtapa`, `BpmCampo.etapaId`, `BpmCampo.obrigatorio` |
| Associação campo/pipeline | `BpmCampo.pipelineId` para propriedade e `BpmCampoPipeline` apenas para compartilhamento real | associações do campo com seu próprio pipeline |
| SLA | `BpmSlaConfig` | `BpmEtapa.slaDias` |
| Cadência/etapa | `BpmCadenciaEtapa` | `BpmCadencia.etapaId` |
| Requisitos de campo | flags e condições de `BpmCampoEtapaConfig` | requisitos `CAMPO`, `ETAPA_CONFIG` e `LEGADO` duplicados |
| Requisitos estruturais | `BpmRequisito` com `campoId = null` | não se aplica |

Não foi criada sincronização bidirecional. Os modelos e atributos legados permanecem no schema apenas para auditoria, rollback e preservação histórica.

## Segurança da alteração

O banco afetado foi o Turso de produção `banco-alpha-alphacomex.aws-us-east-1.turso.io`.

Backup completo imediatamente anterior:

- arquivo: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-09T16-31-01-010Z.sql`;
- manifesto: mesmo nome com sufixo `.manifest.json`;
- SHA-256: `096ba0b48f09eb019f07e46de6fbbcfddf84ba17b6d60f37aebc310a1a1f756a`;
- tamanho: 106.802.339 bytes;
- 306 tabelas e 83.513 linhas;
- restauração descartável aprovada, `PRAGMA integrity_check=ok` e zero violações de FK.

Inventário de rollback específico da aplicação:

`database-backups/pre-change/p0-1-canonical-sources-rollback-2026-09-09T17-03-21-625Z.json`

O dump e o inventário de rollback estão ignorados pelo Git.

## Diagnóstico read-only

Foram localizados leitores/escritores no runtime de cards, comando de transição, Lost, Central de Pendências, administração de pipelines/campos, SLA, cadências, setup financeiro, componentes do board/modal, scripts, migrations e testes.

### Contagens antes/depois

| Item | Antes | Depois |
|---|---:|---:|
| Transições canônicas | 276 | 276 |
| Transições legadas históricas | 19 | 19 |
| Relações legadas sem equivalente canônico | 0 | 0 |
| Configurações campo-etapa | 167 | 202 |
| Associações campo-pipeline | 123 | 29 |
| Associações redundantes ao pipeline proprietário | 94 | 0 |
| Compartilhamentos reais | 29 | 29 |
| Requisitos de campo ativos concorrentes | 55 | 0 |
| Configurações SLA | 0 | 0 |
| `slaDias` legados não nulos | 0 | 0 |
| Relações canônicas cadência-etapa | 1 | 1 |
| Relações singulares sem equivalente canônico | 0 | 0 |

### Migração campo-etapa

Foram criadas 35 relações determinísticas e válidas:

- 19 derivadas de `BpmCampo.etapaId`;
- 2 derivadas de obrigatoriedade legada sem configuração;
- 14 derivadas de ocultação legada sem configuração.

Além disso, 39 configurações existentes receberam `obrigatorio=true` para preservar comportamento comprovadamente ativo. IDs e valores dos campos foram preservados.

### Conflitos

Foram encontrados dois conflitos nos quais `BpmCampoOcultoEtapa` dizia “oculto” e a configuração canônica existente dizia `visivel=true`. Regra aplicada: a configuração canônica preexistente prevaleceu; nenhum valor legado sobrescreveu a autoridade canônica.

Não houve conflito de transição, SLA ou cadência. As 19 relações legadas de transição já possuíam equivalente entre as 276 relações canônicas.

### BpmCampoPipeline

Classificação integral dos 123 registros:

- redundante: 94;
- compartilhamento real: 29;
- necessário por compatibilidade: 0;
- inconsistente: 0.

Somente as 94 redundâncias foram removidas. Os 29 compartilhamentos foram preservados e todos possuem configuração campo-etapa válida no pipeline de destino. A presença numa etapa depende de `BpmCampoEtapaConfig`, nunca apenas de `BpmCampoPipeline`.

## Leitores e escritores alterados

- Movimento e interface de cards consultam somente `BpmTransicaoEtapa` e falham fechados quando a aresta não existe.
- Setup financeiro grava somente `BpmTransicaoEtapa`.
- Runtime de campos, validação, resumo histórico, Lost e Pendências derivam comportamento de `BpmCampoEtapaConfig`.
- CRUD de campo deixou de aceitar/gravar `etapaId` e `obrigatorio` como comportamento por etapa.
- `BpmCampoPipeline` passou a persistir somente compartilhamentos para pipelines diferentes do proprietário.
- Administração, board e runtime deixaram de ler/escrever `slaDias`.
- Administração, ativação automática e executor de cadências usam somente `BpmCadenciaEtapa`.
- O comando de transição consulta `BpmRequisito` somente para requisitos estruturais (`campoId=null`); requisitos de campo vêm da configuração canônica.
- Scripts que escreviam relações obrigatórias legadas e o helper antigo de setup financeiro foram removidos.

## Migração e idempotência

O comando `scripts/bpm-migrate-canonical-sources.mjs`:

- executa dry-run por padrão;
- exige `--apply --confirm P0-1-CANONICAL-SOURCES` para escrita;
- valida configurações inconsistentes/condicionais antes de alterar;
- preserva rollback direcionado;
- usa transação;
- verifica chaves estrangeiras;
- usa IDs determinísticos;
- atualiza obrigatoriedade durante/saída antes de desativar requisitos duplicados.

Em restauração local do backup, a primeira aplicação produziu 167 → 202 configurações, 123 → 29 associações e 55 → 0 requisitos de campo ativos. A segunda aplicação produziu zero alterações.

Após a aplicação em produção, novo dry-run retornou zero inserções, atualizações, remoções ou desativações pendentes. Permanecem apenas os dois conflitos de ocultação já deliberadamente resolvidos pela precedência canônica.

## Preservação operacional

Comparação antes/depois:

| Dado operacional | Antes | Depois |
|---|---:|---:|
| Cards | 3 | 3 |
| Valores de campo | 22 | 22 |
| Soma do tamanho dos valores | 95 | 95 |
| Históricos | 29 | 29 |
| Anexos | 0 | 0 |
| Checklists de card | 2 | 2 |
| Itens de checklist | 6 | 6 |
| Vínculos de cadência com card | 2 | 2 |

Não houve exclusão ou alteração de valores históricos de cards.

## Matriz dos 55 requisitos

Todos eram requisitos simples de campo, sem `condicaoJson`. Classificação:

| Classe | Quantidade | Fonte canônica |
|---|---:|---|
| CAMPO / DURING_STAGE | 26 | `BpmCampoEtapaConfig.obrigatorio` nas etapas configuradas |
| ETAPA_CONFIG / DURING_STAGE | 4 | `BpmCampoEtapaConfig.obrigatorio` |
| ETAPA_CONFIG / EXIT_STAGE | 19 | `BpmCampoEtapaConfig.obrigatorioSaida` |
| LEGADO / DURING_STAGE | 6 | `BpmCampoEtapaConfig.obrigatorio` |

Validação pós-migração: os 26 requisitos globais correspondem a 40 configurações canônicas, todas obrigatórias; os 29 requisitos específicos correspondem a configurações canônicas existentes, com 4/4 `obrigatorio`, 19/19 `obrigatorioSaida` e 6/6 `obrigatorio`.

| Requisito antigo | Alvo/comportamento | Comportamento efetivo | Fonte canônica nova | Status |
|---|---|---|---|---|
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |
| \(.chave) | \(.alvoChave) | \(if .fase == "EXIT_STAGE" then "Obrigatório na saída da etapa" elif .etapaId == null then "Obrigatório durante as etapas configuradas" else "Obrigatório durante a etapa" end) | \(if .fase == "EXIT_STAGE" then "BpmCampoEtapaConfig.obrigatorioSaida" else "BpmCampoEtapaConfig.obrigatorio" end) | MIGRADO; requisito preservado como histórico inativo |

## Prova de ausência de leitores legados

Busca global final:

- `src/`: nenhuma ocorrência de `bpmEtapaTransicaoPermitida`, `bpmCampoObrigatorioEtapa`, `bpmCampoOcultoEtapa`, `slaDias` ou fallback de `cadencia.etapaId`;
- `prisma/schema.prisma`: modelos/colunas históricos, classificados como histórico;
- `prisma/migrations/`: migrations antigas e backfills, classificados como histórico/teste de migração;
- `scripts/bpm-migrate-canonical-sources.mjs`: leitura de legado exclusivamente para migração;
- `scripts/verificar-cadencia-multicoluna-e2e.ts`: escrita controlada do shadow legado para provar que ele não influencia o runtime;
- `tests/`: mocks e asserções negativas de contrato/migração;
- `docs/`: documentação histórica.

Ocorrências classificadas como runtime ativo: **zero**.

## Validação

- Prisma schema: válido.
- Aplicação em restauração local: aprovada duas vezes, com segunda execução sem mudanças.
- Aplicação em produção: aprovada, `integrity_check=ok`, zero violações de FK.
- Dry-run remoto final: zero mudanças pendentes.
- Testes focados P0-1: 14 arquivos, 101 testes, todos aprovados.
- Suíte BPM ampla: 827 testes aprovados e 9 falhas de baseline em UI antiga de card/Standby e mocks de criação de card, fora do contrato consolidado.
- Lint dos arquivos alterados: zero erros; 14 warnings preexistentes nos componentes de card.
- Suíte completa: 2.636 testes aprovados, 30 falhas e 1 todo; as falhas estão no baseline fora do contrato P0-1 (Alpha SEO, Google Calendar, UI antiga de card, gerador de documentos, parceiros e mocks antigos de criação de card).
- Lint global: baseline vermelho por escanear framework/ferramentas e código fora do escopo (3.736 achados).
- Typecheck global: baseline vermelho em módulos fora do escopo; após atualização do teste canônico, não resta erro nos arquivos P0-1.
- Build: geração Prisma e bundle do player concluíram; o Next/Turbopack bloqueou porque o `node_modules` do worktree isolado é um symlink externo à raiz do filesystem do build, não por erro da P0-1.
- CodeRabbit CLI: não instalado neste ambiente; revisão automatizada não pôde ser executada.

## Legado preservado

As tabelas/colunas antigas não foram removidas fisicamente porque são necessárias para rollback e histórico e uma remoção estrutural ampliaria o risco sem benefício operacional. Nenhum caminho ativo depende delas.

## Itens deliberadamente adiados

Para P0-2:

- inventário, classificação e migração dos componentes dos 32 formulários;
- reconciliação dos componentes com `BpmCampoEtapaConfig`;
- preservação de referências CHECKLIST/CAPABILITY;
- save diferencial e prevenção de novas inconsistências.

Para P0-3:

- renderer canônico compartilhado;
- substituição dos painéis hardcoded;
- preview real e convergência builder/card.

Não houve redesign do Form Builder ou da Central de Configurações nesta task.

## Git

A implementação permanece isolada na branch/worktree informada no início. Nenhum push ou merge foi executado.

### git diff --stat

```text
36 files changed, 420 insertions(+), 1671 deletions(-)
```

Os quatro arquivos novos, ainda não rastreados, não entram na contagem acima: este relatório, o relatório de self-critique, o migrador e o teste de contrato canônico.

### git status --short

```text
 M docs/stories/story-saneamento-ontologico-crm-bpm.md
 M prisma/schema.prisma
 D scripts/configurar-novos-leads-campos.mjs
 D scripts/post-audit-novos-leads.ts
 M src/actions/bpm/Cadencias.ts
 M src/actions/bpm/Campos.ts
 M src/actions/bpm/Cards.ts
 M src/actions/bpm/Etapas.ts
 M src/actions/bpm/PipelineFinanceiro.ts
 M src/actions/bpm/Pipelines.ts
 M src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx
 M src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx
 M src/app/PainelAlpha/AlphaCRM/CardModal/PainelResumoEtapas.tsx
 M src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx
 M src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/CadenciaEtapasSection.tsx
 M src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ConfigurarEtapasFinanceiroButton.tsx
 M src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx
 M src/components/bpm/cadencias/CadenciaFormDialog.tsx
 M src/components/bpm/cadencias/types.ts
 M src/lib/bpm/cadencias/ativacao-automatica.ts
 M src/lib/bpm/cadencias/executor.ts
 M src/lib/bpm/lost.ts
 M src/lib/bpm/pendencias/motor.ts
 D src/lib/bpm/pipeline-financeiro-migration.ts
 M src/lib/bpm/requisitos-etapa-server.ts
 M src/lib/bpm/transicao-command.ts
 M src/lib/validations/bpm.ts
 M tests/bpm/cadencias-actions.test.ts
 M tests/bpm/cadencias-ativacao-automatica.test.ts
 M tests/bpm/cadencias-por-coluna.test.ts
 M tests/bpm/crud-campos-bpm.test.ts
 M tests/bpm/fechado-actions.test.ts
 M tests/bpm/kanban-transicao-integracao.test.ts
 M tests/bpm/lost-actions.test.ts
 M tests/bpm/lost.test.ts
 M tests/bpm/pendencias-motor.test.ts
?? docs/reports/crm-config-canonical-sources-p0-1.md
?? plan/self-critique-p0-1.json
?? scripts/bpm-migrate-canonical-sources.mjs
?? tests/bpm/canonical-sources-contract.test.ts
```
