# Vault — CheckList Analistas, 22/10/2026

**Artefatos revisados; backup completo VERIFICADO; execução NÃO AUTORIZADA.** O rótulo de fase do plano hash-contas precisa correção pela Dara e novo dry-run antes de qualquer autorização. Os outros3planos não precisam ser refeitos por essa correção textual de fase. Não se emite consentimento sintético nem arquivo Vault approved=true nesta estação. Forge e revisões locais devem seguir antes da pergunta final ao usuário. Story permanece In Progress.

## Ambiente, escopo e fontes

Alvo exclusivo: banco **staging** do Painel, origem https://staging.alpha-comex.com, fingerprint SHA256 da URL **7fdd160737ba6f9cf84d0ac2fb1c3cf1084311e7fccea454f7bac368f9e4d42b**. Produção não foi consultada por SQL nem configurada. O código base é staging d7580d079b590e0ad8012f63145f241b3ed36a10; main feature HEAD contém merge a950f33e. O ambiente efetivo foi lido exclusivamente do arquivo regular0600 `/home/ialpha/.config/painel-alpha/checklist-staging-20261022/database/.env.staging.local`; marcadores staging/origin/fingerprint conferidos. Nenhum default .env.local foi carregado e os envs dos roots sujos foram preservados.

Regras lidas integralmente: AGENTS.md, Constitution e `.agents/skills/bibble-squad/vault/SKILL.md`. Modo remoto exige backup/consentimento mesmo para DDL aditiva de baixo risco. Este documento prepara a revisão e apresentação; não substitui confirmação inequívoca do usuário ao plano exato.

## SQL independente: contagem correta e equivalência

Artefato único proposto: `prisma/migrations/20261022143000_checklist_analistas_crm/migration.sql`, SHA256 **5c9affa7859fe9ea95ccc3e2fa995487ef6ee2c95e35d0063cdc64c01f41948d**. Contagem independente: **67 statements:26 ADD COLUMN +5 CREATE TABLE +24 CREATE INDEX +12 CREATE UNIQUE INDEX**. A referência anterior a30colunas estava incorreta. Não há DROP, RENAME, rebuild, desligamento de FKs, INSERT/UPDATE/DELETE ou backfill no SQL proposto. Cada ADD é nullable ou possui DEFAULT explícito; todos os dados antigos permanecem e analistaId fica NULL, sem inferência por pasta/nome/CNPJ.

Executado **LOCALMENTE**, sem URL remota: `prisma migrate diff --from-schema-datamodel <base d758.prisma> --to-schema-datamodel prisma/schema.prisma --script --output <diff-local.sql>`. O script automático gerado contém7rebuilds com DROP/cópia/RENAME: **NÃO APLICAR ESSE DIFF**. Ele é apenas comparativo.

Também gerados DDLs canônicos locais from-empty da base e target. Base canônica + SQL aditivo comparados ao target em SQLite descartável:323tabelas modeladas, conjuntos iguais, colunas/FKs/listas de índices/SQL de índices iguais,0divergências e FK0. Isso valida equivalência estrutural modelada; **não confundir323tabelas modeladas com backup do banco real de337tabelas**. O backup abaixo inclui TODAS as tabelas reais, inclusive legadas fora do datamodel, todos os949índices e2triggers; as0views observadas não foram omitidas por filtro Prisma. Tabelas internas relevantes de AUTOINCREMENT também foram preservadas.

Evidência comparativa: `/tmp/checklist-vault-20261022/prisma-diff.sql`, `base-full.sql`, `target-full.sql`, `all-tables-equivalence.json`. Rodada focal independente31testes/2arquivos PASS (schema.contract e operations), sem alegar4gates globais. Não repetir backup/testes por rotina.

## Classificação individual dos67statements

🟢55 de baixo risco e 🟡12 de unicidade condicionada ao préestado NOT_APPLIED/NULL/tabelas novas vazias. Nenhuma classificação libera aplicação: backup, préestado/CAS e consentimento continuam obrigatórios. FKs nas tabelas novas vazias só passam a restringir inserts futuros; em colunas novas nullable preservam legados. ON DELETE CASCADE/RESTRICT/SET NULL novos não provocam exclusão nesta migration. Índices podem manter lock de escrita durante construção; não há tempo de indisponibilidade medido/prometido.

| Nº | Comando | Objeto | Classificação | Evidência/condição |
|---:|---|---|---|---|
| 1 | CREATE TABLE | `ModeloChecklistIdentidade` | 🟢 Baixo | Tabela nova vazia; FKs somente em novos registros, sem cópia/remoção de linhas existentes. |
| 2 | CREATE TABLE | `ChecklistCrmVinculo` | 🟢 Baixo | Tabela nova vazia; FKs somente em novos registros, sem cópia/remoção de linhas existentes. |
| 3 | CREATE TABLE | `ChecklistEvento` | 🟢 Baixo | Tabela nova vazia; FKs somente em novos registros, sem cópia/remoção de linhas existentes. |
| 4 | CREATE TABLE | `ChecklistEventoLeitura` | 🟢 Baixo | Tabela nova vazia; FKs somente em novos registros, sem cópia/remoção de linhas existentes. |
| 5 | CREATE TABLE | `ChecklistUploadRecibo` | 🟢 Baixo | Tabela nova vazia; FKs somente em novos registros, sem cópia/remoção de linhas existentes. |
| 6 | ADD COLUMN | `Auditoria.checklistEventoId` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 7 | ADD COLUMN | `ClienteOperacional.senhaHash` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 8 | ADD COLUMN | `ClienteOperacional.authSessionVersion` | 🟢 Baixo | NOT NULL com DEFAULT explícito; nenhum valor legado removido. |
| 9 | ADD COLUMN | `ClienteOperacional.resetSenhaTokenHash` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 10 | ADD COLUMN | `ClienteOperacional.resetSenhaExpiraEm` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 11 | ADD COLUMN | `NotificacaoCliente.eventoId` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 12 | ADD COLUMN | `operacional_clientes.analistaId` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 13 | ADD COLUMN | `operacional_clientes.revision` | 🟢 Baixo | NOT NULL com DEFAULT explícito; nenhum valor legado removido. |
| 14 | ADD COLUMN | `ModeloItemChecklist.identidadeId` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 15 | ADD COLUMN | `ModeloItemChecklist.versao` | 🟢 Baixo | NOT NULL com DEFAULT explícito; nenhum valor legado removido. |
| 16 | ADD COLUMN | `ModeloItemChecklist.ativo` | 🟢 Baixo | NOT NULL com DEFAULT explícito; nenhum valor legado removido. |
| 17 | ADD COLUMN | `ModeloItemChecklist.ordem` | 🟢 Baixo | NOT NULL com DEFAULT explícito; nenhum valor legado removido. |
| 18 | ADD COLUMN | `ModeloItemChecklist.autorId` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 19 | ADD COLUMN | `ItemChecklist.modeloRevisaoId` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 20 | ADD COLUMN | `ItemChecklist.ordem` | 🟢 Baixo | NOT NULL com DEFAULT explícito; nenhum valor legado removido. |
| 21 | ADD COLUMN | `DocumentoChecklist.storageProvider` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 22 | ADD COLUMN | `DocumentoChecklist.storageKey` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 23 | ADD COLUMN | `DocumentoChecklist.storageAccess` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 24 | ADD COLUMN | `DocumentoChecklist.tamanhoBytes` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 25 | ADD COLUMN | `DocumentoChecklist.mimeType` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 26 | ADD COLUMN | `DocumentoChecklist.sha256` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 27 | ADD COLUMN | `DocumentoChecklist.uploadedByUsuarioId` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 28 | ADD COLUMN | `DocumentoChecklist.uploadedByContaId` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 29 | ADD COLUMN | `DocumentoChecklist.deletadoPorUsuarioId` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 30 | ADD COLUMN | `DocumentoChecklist.deletadoPorContaId` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 31 | ADD COLUMN | `Checklist.modelosSnapshot` | 🟢 Baixo | Nullable/default mantém dados existentes; dono/modelo/storage não inferidos. |
| 32 | UNIQUE INDEX | `Auditoria_checklistEventoId_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 33 | UNIQUE INDEX | `ClienteOperacional_resetSenhaTokenHash_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 34 | UNIQUE INDEX | `NotificacaoCliente_eventoId_clienteId_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 35 | INDEX | `operacional_clientes_analistaId_createdAt_id_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 36 | INDEX | `operacional_clientes_clienteOperacionalId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 37 | INDEX | `operacional_clientes_createdAt_id_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 38 | INDEX | `ModeloItemChecklist_autorId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 39 | INDEX | `ModeloItemChecklist_tipo_ativo_secao_ordem_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 40 | UNIQUE INDEX | `ModeloItemChecklist_identidadeId_versao_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 41 | INDEX | `ItemChecklist_modeloRevisaoId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 42 | INDEX | `ItemChecklist_checklistId_secao_ordem_id_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 43 | INDEX | `DocumentoChecklist_uploadedByUsuarioId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 44 | INDEX | `DocumentoChecklist_uploadedByContaId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 45 | INDEX | `DocumentoChecklist_deletadoPorUsuarioId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 46 | INDEX | `DocumentoChecklist_deletadoPorContaId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 47 | INDEX | `ModeloChecklistIdentidade_autorId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 48 | UNIQUE INDEX | `ModeloChecklistIdentidade_escopo_codigoNormalizado_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 49 | UNIQUE INDEX | `ChecklistCrmVinculo_cardId_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 50 | INDEX | `ChecklistCrmVinculo_empresaOperacionalId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 51 | INDEX | `ChecklistCrmVinculo_autorId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 52 | UNIQUE INDEX | `ChecklistEvento_mutationId_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 53 | INDEX | `ChecklistEvento_empresaId_createdAt_id_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 54 | INDEX | `ChecklistEvento_publicadoEm_proximaTentativaEm_claimAte_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 55 | INDEX | `ChecklistEvento_createdAt_id_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 56 | INDEX | `ChecklistEvento_atorUsuarioId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 57 | INDEX | `ChecklistEvento_atorContaId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 58 | UNIQUE INDEX | `ChecklistEvento_agregadoTipo_agregadoId_revision_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 59 | INDEX | `ChecklistEventoLeitura_usuarioId_lidoEm_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 60 | UNIQUE INDEX | `ChecklistEventoLeitura_eventoId_usuarioId_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 61 | UNIQUE INDEX | `ChecklistUploadRecibo_tokenHash_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 62 | UNIQUE INDEX | `ChecklistUploadRecibo_documentoId_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |
| 63 | INDEX | `ChecklistUploadRecibo_empresaId_expiresAt_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 64 | INDEX | `ChecklistUploadRecibo_itemId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 65 | INDEX | `ChecklistUploadRecibo_usuarioId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 66 | INDEX | `ChecklistUploadRecibo_clienteOperacionalId_idx` | 🟢 Baixo | Índice não único; não altera valores. Pode reter lock durante construção. |
| 67 | UNIQUE INDEX | `ChecklistUploadRecibo_storageProvider_storageKey_key` | 🟡 Condicional | Unicidade em tabela nova vazia ou coluna nova NULL; revisar préestado para afastar fase parcial/duplicatas. |

## Backup completo fresco e restauração comprovada

- SQL: `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.sql`.
- Manifesto0600: `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.manifest.json`.
- Snapshot SQLite nativo adicional0600: `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.sqlite` — 388,182,016bytes, SHA256 `994b16a39e2226f27788017bda25e70b7546dde1f5bc7795bdea85c8372a79ea`.
- Captura consistente: **2026-10-22T17:51:45.307Z**; manifesto **2026-10-22T17:52:22.115Z**; restore verificado **2026-10-22T17:54:38.117Z**. Idade na emissão deste relatório: **0.204h**, inferior a48h. Conferir de novo imediatamente antes de aplicar; backup vencido bloqueia execução.
- SQL **360,811,599bytes**, não vazio, SHA256 **30b31bbef7c4e462c49bf22150ec4150f6bcc5d4ee035ec47d0fc67197acdd5e**;337tabelas de usuário, **295,932linhas**. SQLite possui338tabelas contando sqlite_sequence,949índices,2triggers e0views. Sequências AUTOINCREMENT preservadas e conferidas por hash agregado.
- Diretórios database-backups/pre-change700 e arquivos600, ignorados pelo Git, verificado com git check-ignore. Dumps e manifestos com dados/config são sensíveis e não serão versionados. Nenhum backup anterior foi apagado.

Método: código existente de backup/verificação foi inspecionado. Entry points existentes carregam .env.local por default, portanto não foram executados assim; Prisma backup não foi usado com schema novo/tabelas ausentes. Wrapper TEMP explícito em diretório privado validou staging/env600 e fez sync de réplica nova para disco local. Depois de sync concluído, uma cópia consistente via API SQLite online backup foi concluída antes de encerrar o wrapper libsql cujas seleções estavam lentas. Export lógico foi feito SOMENTE do snapshot offline em transação de leitura local, com schema/data/índices/triggers/views e sqlite_sequence; BLOBs e textos com NUL serializados sem perda, inteiros lidos como BigInt na exportação. Nenhum write SQL remoto foi emitido. Réplica temporária desta operação foi removida pelo handler do próprio processo; backups antigos/pre-change ficaram intactos.

Verificação, sem rede: restore integral SQL em SQLite local temporário independente usando lógica do verificador existente ampliada apenas em wrapper TEMP; SHA/bytes, integrity_check=ok, foreign_key_check=0, quantidade de tabelas/linhas total **e de CADA tabela iguais**, schema SQL de todos objetos por SHA igual, contagem de todos índices/triggers igual e sqlite_sequence igual. Snapshot nativo também teve SHA/bytes/integrity/FKs verificados. Resultado seguro `/tmp/checklist-vault-20261022/backup-verification.json`; nenhum conteúdo de linha/senha/token/digest individual de credencial foi exibido.

O manifesto continua compatível com o guard CLI: generatedAt/databaseHash/sizeBytes/tables/totalRows/sha256, com metadados adicionais de verificação. Nenhuma restauração em banco remoto foi feita ou autorizada.

## Préestado atual e quatro planos dry-run

Diagnóstico real somente leitura: canonical=true, NOT_APPLIED, blockers0, owners futurosNULL4, órgãos/FKs/status desconhecidos0. Ledger `_prisma_migrations` **ausente** e permanece assim; não baselinar/resolve/deploy automaticamente.3modelos elegíveis sem colisões. Reconsulta agregada **2026-10-22T17:54:43.501Z**:2contas legadas,0senha vazia,0senha acima de72bytes UTF8,0documentos,0fotos de conta,0pasta Teste,FK0. Sem Pasta é virtual. Não incluir DELETE Teste, migração/revogação de objetos ou atribuição automática de dono nesta autorização futura.

Todos os comandos abaixo já executados **SEM --apply**, usando CLI CURRENT e env explícito. Arquivos dos planos completos600 em `/tmp/checklist-vault-20261022/plans/`, sem senha/hash/token/URL ou digest individual de segredo.

| Operação | Plano SHA256 atual | Resultado | Estado de revisão |
|---|---|---|---|
| `schema` | `d05371e72b6b6ad54079429c6f52eb60ea01df7f9f066efe794e8f72e50e564f` | 26colunas +5tabelas +36índices explícitos | Préestado sem bloqueios; NÃO AUTORIZADO aplicar |
| `bootstrap-modelos` | `69b3c4bcf5b727879e6ac7991ac7c1cb12a6a8c367ef43a63f42b9049551c136` | 3identidades/revisões; snapshots antigos intocados | Préestado sem bloqueios; NÃO AUTORIZADO aplicar |
| `habilitar-lider-checklist` | `a7b25eff2ac9966fc6df6f54c01a36d9e49158c99c821ae15b66f37d7f1bda4d` | 5vínculos;1membro atual;4módulos preservados +checkList | Préestado sem bloqueios; NÃO AUTORIZADO aplicar |
| `hash-contas` | `3264ef79addb922d023ecd89cee67acdce1168eff415b52e32f2badf4243f2ba` | 2conversões bcrypt12 projetadas;invalid0;sem mutação | PENDENTE corrigir rótulo de fase e recalcular; NÃO USAR ESSE HASH PARA APPLY |

CLI de planejamento já executada para cada operação:

```sh
node scripts/checklist-analistas/cli.mjs plan --operation <operacao> --env-file /home/ialpha/.config/painel-alpha/checklist-staging-20261022/database/.env.staging.local
```

A mudança futura real somente será concreta e autorizável após Forge/revisões e correção da fase hash. Modelo de comando para apresentação, **NÃO EXECUTADO**:

```sh
node scripts/checklist-analistas/cli.mjs plan --operation <operacao-exata> --env-file <env-staging-0600> --apply --consent <consentimento-real-da-operacao.json> --vault <relatorio-aprovado-da-operacao.json> --backup <sql-verificado> --manifest <manifesto-verificado>
```

Hash-contas ainda exige `--reader-evidence <evidencia-real-Portal.json>` e CHECKLIST_PORTAL_ORIGIN correspondente. **Essa evidência não existe ainda**: Portal staging sem deployment READY/auth/E2E comprovados; não fabricar validated=true/deployment/commit/checks. O CLI valida reader; a cessação do escritor antigo é gate operacional externo, não uma capacidade já validada automaticamente pelo CLI. Os três planos restantes podem ser reaproveitados se código/préestado/fingerprint/hashes continuarem iguais; revalidar CAS no momento da execução. Nenhum arquivo de consentimento ou de aprovação operacional foi fabricado.

Grant setorial: inserir exatamente chamados, Documentos, UpDocumentos, Extratos e checkList no role exato Lider Operacional. Não adicionar apenas checkList, pois a primeira configuração setorial desliga fallback e retiraria quatro acessos. Snapshot/CAS cobre membros ativos/inativos, cadastros, overrides e catálogo; grant não troca role/owner/permissoes de usuário nem overrides, preserva os4módulos atuais. Quem tem o role exato futuramente herda a regra setorial; isso está explícito no plano.

Hash: bcrypt12 + limpeza senha='' na mesma transação, CAS id/segredo anterior/hash/versão, sem mudar senha do cliente ou versão de sessão. Hash válido existente é pulado; cópia legada com hash, inválido, vazio ou>72bytes bloqueia. Mudança concorrente interrompe lote e reverte todas as conversões. A classificação segura não autoriza executar agora.

## Ordem real de rollout, impacto e cessação do escritor antigo

Contrato mais recente: arquitetura§14, substituindo rótulos antigos em operations.mjs/docsdata. Preparação não é aplicação:

1. Concluir correção de fase hash, Forge/revisões e plano final; apresentar ao usuário ambiente/artefatos/backup/hashes/riscos/alternativa/rollback e obter consentimento específico antes de DDL/massa. Backup/planos abaixo não são esse consentimento.
2. Com autorização válida e backup<=48h, aplicar somente schema aditivo; pós-verificar NOT_APPLIED→APPLIED/FKs/contagens. Bootstrap3 e grant5 somente por seus planos/CAS exatos. Preservar ownerNULL e todos os legados; não escrever ledger.
3. Publicar Portal LEITOR compatível primeiro em custom staging; comprovar commit real, READY, host/TLS, DB binding e testes de login hash/upgrade legado/sessãoversion com evidência honesta. LiveAuthenticatedE2E=false enquanto não realizado; fixtures locais não são teste remoto.
4. Publicar Painel ESCRITOR de hash novo depois; conferir READY/alias staging/commit/config/destino e que os comandos novos nunca criam plaintext. Confirmar cessação do escritor antigo ANTES do hashbatch.
5. Executar hash-contas somente após reader comprovado +writer novo +cessação antiga +backup/consentimento/CAS/plano da fase corrigida. Reconciliar2legados→hashes válidos/senha vazia, sem alterar sessões e sem regressão por produtor antigo. Qualquer novo plaintext bloqueia encerramento e exige investigação.
6. Validar avisos por journal/polling autenticado; **NÃO instalar, habilitar timer ou chamar worker Pusher**. Transporte exclusivo polling conforme arquitetura; artefatos antigos de timer são inertes e não entram na ativação.

Cessação do escritor antigo precisa prova operacional, não apenas novo alias: listar deployments e URLs antigas staging que ainda executam criadores/editores/reset plaintext; conferir qual commit e runtime cada URL alcança e quais controles de acesso estão ativos. Apontar alias principal ao novo deployment não torna automaticamente inacessíveis URLs antigas `.vercel.app`. Encerrar/drenar requisições antigas antes da janela hash com evidência de execução/tráfego e limites de duração, sem supor que aguardar um intervalo arbitrário seja suficiente. Se URLs antigas ainda puderem executar actions, bloquear acesso aos escritores/deployments antigos por proteção/restrição válida ou retirar somente deployments antigos identificados em plano separado, preservando leitor compatível e rollback. Capacidade de proteção Vercel e seu alcance por deployment/customenv precisam ser verificados na operação; pode exigir autenticação/step-up ou ação adicional explicitamente autorizada. **Nenhum deployment foi protegido/desativado/excluído nesta estação e não existe prova de que todas as URLs antigas ficaram inacessíveis.** Não aplicar proteção global que afete produção inadvertidamente. Se não for possível provar a cessação, hashbatch permanece bloqueado.

Impactos/riscos: DDL e índices podem reter lock de escrita e impedir operações concorrentes por uma janela não medida; executar em janela operacional acordada. Novos FKs/uniques serão restrições para futuras gravações, com rollback transacional em falha. Bootstrap não altera itens já materializados; nova seleção usa catálogo versionado. Grant amplia apenas checkList ao setor preservando seus acessos atuais. Hash remove cópia recuperável de senha: não existe reversão criptográfica para plaintext; leitor compatível deve permanecer disponível. Falha no Portal ou credencial Blob bloqueada pode impedir login/upload; não promover produção nem declarar homologação antes das provas.

## Alternativa não destrutiva e rollback

Alternativa: manter staging na versão atual enquanto se concluem gates/configuração/acesso Blob/consentimento; código e planos continuam revisáveis sem migração. Deixar grant e hashbatch para janela específica também é possível; sem grant líder não poderá atribuir donos/catálogo e os2legados continuam texto até login oportunista ou lote aprovado. Nenhuma transformação automática de donos/arquivos/pastas é necessária neste préestado.

Rollback preferido: manter schema aditivo e leitores compatíveis com senhaHash/snapshots/eventos; reverter só código compatível, nunca voltar ao autenticador exclusivamente plaintext. Não executar DROP de colunas/tabelas. DDL/bootstrap/grant ocorrem em transações próprias que revertem em falha; mudanças posteriores à execução precisam ser respeitadas. Reverter grant exige snapshot prévio, pós-CAS e plano específico para evitar apagar permissões posteriores. Não reconstruir senha legada nem sobrescrever login/reset concorrente. Restore remoto COMPLETO a partir do backup é último recurso com janela de manutenção, avaliação dos writes posteriores, nova revisão Vault/backup/consentimento; pode descartar dados escritos após17:51:45UTC e exige explicar essa perda. Nenhuma restauração remota está autorizada neste documento.

Verificação/restauração segura atual é SOMENTE local: ler manifesto+SHA, importar SQL em SQLite descartável, integrity/FK/counts/schema/sequence. O wrapper temporal já concluiu isso e não precisa ser repetido para a correção do rótulo hash; a idade deve ser reavaliada antes de qualquer apply.

## Veredito e próximos gates

- Revisão do SQL custom:67statements classificados, equivalência local confirmada; 7rebuilds automáticos reprovados para execução.
- Backup completo e restore:VERIFICADO,337tabelas reais preservadas, inclusive objetos que não constam no datamodel.
- Planos:schema/bootstrap/grant revisados sem bloqueio de préestado; hash exige correção pequena de fase e novo planSha, com MESMO backup se válido.
- Execução real:NÃO AUTORIZADA; sem DDL, grant, hashbatch, migração de objetos, delete Teste, seed, ledger, timer, backup de produção, publicação ou mudança cloud nesta estação.
- Próximos responsáveis:Bibble aciona Dara para fase hash; Forge4gates locais e revisões; depois apresentação final e consentimento específico. Blob403 exige autenticação legítima separada e não impediu este backup/revisão. Não contornado.

Evidências seguras: `/tmp/checklist-vault-20261022/{plan-summary.json,current-aggregate-counts.json,all-tables-equivalence.json,statement-review.json,backup-verification.json,backup-artifacts.json}`. Dumps/manifestos/planos completos600 fora Git, não imprimir dados. Nenhum arquivo de aplicativo/schema foi modificado pelo Vault; somente documentos permitidos e artefatos de backup/planejamento locais.


## Adendo Dara — fase corrigida,22/10/2026

A pendência textual de fase acima foi resolvida sem reescrever a evidência histórica do Vault. Novo planSha256 `hash-contas`: `1bd13b1afa8b4d27abd0745db15619a6583166c5b36bda98622ca5aea806254c`; dry-run real staging às18:06:46UTC de22/10/2026,2conversões projetadas/0inválidas/0bloqueios/0mutações. Plano privado0600: `/tmp/checklist-vault-20261022/plans/hash-contas-phase-corrected.json`; resumo seguro0600: `/tmp/checklist-vault-20261022/hash-contas-phase-summary.json`. Diagnóstico idêntico ao anterior; operationPlan difere somente em phase. Hash antigo3264ef79… continua histórico, NÃO USAR PARA APPLY.

Phase vigente: `AFTER_SCHEMA_BOOTSTRAP_GRANT_AND_VALIDATED_PORTAL_READER_AND_READY_PANEL_HASH_WRITER_AND_LEGACY_WRITER_CESSATION`. Ordem §14 preservada: schema/bootstrap3/grant5 → Portal leitor READY validado → Painel escritor hash READY/cessação antiga comprovada operacionalmente → hashbatch → polling sem timer. Nenhum novo guard/proof automatiza cessação do escritor; faltam as provas operacionais reais. ESLint focado e17testes existentes de operações PASS. Backup verificado e3outrosplanos permanecem os anteriores, sem recaptura/reexecução. Execução continua NÃO AUTORIZADA; Forge/revisões e consentimento específico ainda pendentes. Nenhum approved=true emitido.
