# Vault — CheckList Analistas, 22/10/2026

**STATUS ATUAL — consentimento específico recebido (resposta literal “sim”, observado20:16:25UTC22/10/2026).** Preflight staging somente leitura sem drift, quatro planosSHA idênticos e backup completo válido. Vault libera SOMENTE schema/bootstrap3/grant5 sob guardasCLI e ordem validada; hash2 já consentido, mas aguarda provas reais de leitorPortalREADY/escritorPainelREADY/cessação antiga e não tem aprovação emitida. Nenhuma escrita aplicada nesta estação. Story In Progress; produção fora do escopo. Registros anteriores de aguardar consentimento são históricos, superados pelo adendo final; pendências operacionais continuam reais.

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

## Vault — plano final específico de staging, 22/10/2026

**ARTEFATOS REVISADOS / BACKUP VÁLIDO / AGUARDA CONSENTIMENTO.** Plano documental pronto para apresentação pelo Bibble. Nenhuma operação descrita abaixo foi aplicada; nenhum consentimento ou arquivo de aprovação foi fabricado. Esta consolidação encerra as pendências documentais anteriores de fase hash e gates locais. A story continua In Progress.

### Ambiente e entrega revisável

Alvo exclusivo: banco Turso de **staging**, usado por `https://staging.alpha-comex.com` e pelo futuro Portal `https://clientes-staging.alpha-comex.com`. Fingerprint SHA256 da URL: `7fdd160737ba6f9cf84d0ac2fb1c3cf1084311e7fccea454f7bac368f9e4d42b`, distinto de produção. CLI deve usar somente `/home/ialpha/.config/painel-alpha/checklist-staging-20261022/database/.env.staging.local` (arquivo regular0600). O hostname do Portal está associado/verificado, porém ainda não tem deployment READY comprovado. Produção não integra esta autorização.

Código Main revisável: commit `584856ebac7760707baf60853b28eb870515b239`, árvore `dcd4530fb8dddb9e72d80a2fceaf897a3b525bf4`; Portal `7d12f74d7de2895d49a4ea1b2356cef39427ea64`, árvore `56dbb7a7c947e0cb1e265a0d25612c9714646508`. A01–A17/AC1–12 implementados localmente, sem achado local aberto. Forge Main combinado: typecheck/lint/test/build exit0,737 arquivos/5958PASS (+4skip/1todo preexistentes); lint0erros/1183warnings preexistentes. Portal: typecheck/lint/build PASS,57testes+3nativos de paridade; revisões Probe/Flux, Anubis, Lens e QA adotadas pelas114sources Main e69Portal intactas. Isso comprova implementação local, não homologação remota. Evidências: `/tmp/checklist-analistas-20261022-{forge-merged,devops-readiness,qa-readiness}.md`.

### Quatro operações propostas, com limites exatos

| Ordem | Operação CLI | Mudança e impacto |
|---|---|---|
| 1 | `schema` | Aplicar somente o SQL custom revisado:26colunas nullable/com default,5tabelas novas e36índices (24normais/12únicos),67statements. Estruturas para owner/revisão, modelos, CRM, eventos, credenciais e documentos privados. Sem DROP, rename, reconstrução ou backfill; dados existentes preservados e4owners futuros NULL. Índices/DDL podem bloquear escritas temporariamente; duração não medida, sem promessa de indisponibilidade zero. Unicidade exige préestado exato, sem aplicação parcial/colisões. |
| 2 | `bootstrap-modelos` | Associar os3modelos legados elegíveis às identidades/revisões do catálogo. Itens, snapshots e checklists já existentes preservados; catálogo novo vale para instâncias futuras. Transação e conferência do conjunto exato impedem fusão/escolha automática em colisões. |
| 3 | `habilitar-lider-checklist` | Inserir5vínculos setoriais no cadastro existente da role exata `Lider Operacional`: `chamados`, `Documentos`, `UpDocumentos`, `Extratos`, `checkList`. Os4acessos efetivos anteriores permanecem; acrescenta apenas CheckList efetivo. Abrange1membro atual e futuros membros dessa role; não troca role, overrides, dono, sessão ou bypass Admin. `UpDocumentos` é token legado preservado, sem criar módulo. |
| 4, condicionada ao rollout | `hash-contas` | Converter as2contas legadas válidas para bcrypt fator12 e limpar `senha=''` na mesma transação. Preserva a senha usada pelo cliente e `authSessionVersion`. Remove a cópia em texto claro; hash não permite reconstruí-la. CAS compara estado/segredo/hash/versão; mudança concorrente, conta inválida/vazia/>72bytes ou divergência reverte/bloqueia o lote. Só após leitor Portal READY validado, escritor Painel hash READY e cessação comprovada dos escritores antigos. |

SQL exclusivo: `prisma/migrations/20261022143000_checklist_analistas_crm/migration.sql`, SHA256 `5c9affa7859fe9ea95ccc3e2fa995487ef6ee2c95e35d0063cdc64c01f41948d`. Os67statements já foram classificados individualmente neste relatório:55baixo risco/12unicidade condicional. Equivalência local das323tabelas modeladas PASS; o banco real/backup tem337tabelas. **Prisma diff automático com7DROP/rebuild foi reprovado e não será usado.** Não executar `db push`, `migrate deploy`, baseline ou gravação no ledger ausente.

| Operação | planSha256 autorizado somente após confirmação real |
|---|---|
| schema | `d05371e72b6b6ad54079429c6f52eb60ea01df7f9f066efe794e8f72e50e564f` |
| bootstrap-modelos | `69b3c4bcf5b727879e6ac7991ac7c1cb12a6a8c367ef43a63f42b9049551c136` |
| habilitar-lider-checklist | `a7b25eff2ac9966fc6df6f54c01a36d9e49158c99c821ae15b66f37d7f1bda4d` |
| hash-contas | `1bd13b1afa8b4d27abd0745db15619a6583166c5b36bda98622ca5aea806254c` |

O hash-contas3264ef79… é obsoleto. O plano vigente foi corrigido pela Dara e planejado sem mutação às18:06:46UTC. Todos os quatro planos são dry-run. A fotografia read-only de17:54UTC era4atendimentos/6checklists/10itens/3modelos/2contas legadas válidas,0docs/0fotos/0Teste/FK0 e ledger ausente. Antes de aplicar, conferir novamente fingerprint, préestado, plano e CAS; após cada fase, validar estrutura/contagens/FKs/preservações e reconciliar resultados. Não existe DELETE Teste, migração/revogação de arquivos ou atribuição automática de dono neste plano. Divergência do conjunto ou escopo exige novo plano e nova confirmação.

### Comandos preparados para execução futura, não executados

Diretório de trabalho obrigatório: `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022`. Os comandos abaixo são modelos com os quatro nomes de operação fechados. Os caminhos entre `<...>` somente podem ser substituídos por evidências reais depois da resposta inequívoca do usuário e do cumprimento dos gates; esses arquivos de aprovação/consentimento/leitor ainda não existem.

```bash
# Argumentos comuns: apenas o ambiente staging e o backup já verificado.
checklist_stage_args=(
  --env-file /home/ialpha/.config/painel-alpha/checklist-staging-20261022/database/.env.staging.local
  --backup /home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.sql
  --manifest /home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.manifest.json
)
node scripts/checklist-analistas/cli.mjs plan --operation schema "${checklist_stage_args[@]}" --apply --consent <consent-schema-real.json> --vault <vault-schema-real.json>
node scripts/checklist-analistas/cli.mjs plan --operation bootstrap-modelos "${checklist_stage_args[@]}" --apply --consent <consent-bootstrap-real.json> --vault <vault-bootstrap-real.json>
node scripts/checklist-analistas/cli.mjs plan --operation habilitar-lider-checklist "${checklist_stage_args[@]}" --apply --consent <consent-grant-real.json> --vault <vault-grant-real.json>
# Só depois dos deploys/provas reais abaixo:
node scripts/checklist-analistas/cli.mjs plan --operation hash-contas "${checklist_stage_args[@]}" --apply --consent <consent-hash-real.json> --vault <vault-hash-real.json> --reader-evidence <portal-reader-real.json>
```

As evidências futuras vinculam ambiente, fingerprint, operação, planSha e backupSha, com identidade/data da confirmação verdadeira; nenhum `confirmed=true` ou `approved=true` será inventado. O processo guardado verifica backup/restauração e prazos no apply. Não é necessário repetir agora dump/restauração/gates já aprovados para apresentar o plano.

### Backup completo e validade

Arquivo: `database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.sql`, acompanhado de `.manifest.json` e snapshot nativo `.sqlite` no mesmo worktree. Captura consistente em **22/10/2026 às14:51:45 America/Sao_Paulo (17:51:45UTC)**; manifesto17:52:22UTC; restauração local integral verificada às14:54:38local/17:54:38UTC. SQL **360.811.599bytes (360,8MB)**, SHA256 `30b31bbef7c4e462c49bf22150ec4150f6bcc5d4ee035ec47d0fc67197acdd5e`.

Cobertura:337tabelas reais,295.932linhas,949índices,2triggers,0views,mais sqlite_sequence. Restore independente confirmou integridade,0violações FK, contagem de cada tabela, schema de todos os objetos e sequências iguais. Snapshot nativo adicional também verificado. Evidências seguras: `/tmp/checklist-vault-20261022/backup-verification.json` e `backup-artifacts.json`. Manifesto lido apenas por campos seguros; stat600 e tamanhos conferidos nesta estação; diretório700/arquivos600, ignorados no Git. Nenhum dump ou segredo foi lido/recalculado nesta estação.

Às **19:36:36UTC** a idade era **1,748h (cerca de1h45)**. Completa48h em **24/10/2026 às14:51:45local/17:51:45UTC**. Deve continuar íntegro e≤48h em cada aplicação; expirado/inválido bloqueia e exige novo backup completo verificado. Não houve mutação de banco por esta equipe desde a captura. Esse registro não presume ausência de gravações externas posteriores; préestado será conferido antes da operação.

### Sequência operacional e pendências reais

Com consentimento específico válido e backup/préestado conferidos: schema → bootstrap3 → grant5 → publicar/validar **Portal leitor** no custom staging → publicar/validar **Painel escritor de hashes** → comprovar cessação dos escritores plaintext antigos → hashbatch2 → homologação autenticada staging.

A prova real do leitor precisa commit/deployment READY/host/TLS/origin, binding ao banco staging e validações legítimas de login hash, upgrade legado e versão de sessão; `CHECKLIST_PORTAL_ORIGIN` deve corresponder ao host comprovado e a evidência deve respeitar a validade exigida pelo CLI. Essa prova ainda não existe. O gate do escritor exige READY/commit/configuração e cessação real de URLs/actions/requisições antigas: mudar apenas o alias não cessa deployments antigos. O CLI não automatiza essa cessação. Sem prova, hashbatch fica pendente, mesmo com consentimento. Proteger/desativar/excluir deployments, se necessário, exige plano próprio de alcance exato, sem afetar produção; esta autorização de banco não inclui essas ações.

Uploads de PDFs/imagens dependem da credencial do novo store privado staging; obtenção legítima ainda retorna403challenge_required. Não há autenticação concluída comprovada: o código temporário apresentado expirou às19:31UTC, sem resposta do usuário, e a sessão de execução já não está disponível. Não há garantia de liberação automática. Falta de Blob não impede apresentar o plano de banco, mas impede concluir a homologação dos uploads. Consentir banco não autentica Vercel. Não pedir nem imprimir segredos. Transporte CheckList continua journal/polling6/30s e SSE Portal; sem instalar/ativar timer, cron, worker ou app Pusher.

### Riscos, alternativa e rollback

Perda esperada de registros/documentos/checklists: **nenhuma** no plano aditivo/preservatório. DDL, criação de índices e transações podem reter locks e afetar escritas concorrentes; não foi medido tempo de execução. Uniques/FKs passam a restringir futuras gravações. Falha transacional ou CAS impede commit da operação correspondente; as quatro fases não constituem uma única transação global. Não prometer disponibilidade contínua. Hash remove irreversivelmente a cópia em texto claro, embora preserve a senha de login; leitor hash compatível deve permanecer disponível para evitar falha de acesso.

Alternativa não destrutiva: manter staging na versão atual enquanto se concluem acessos/provas e se decide a autorização; código/planos permanecem revisáveis. Adiar o batch mantém os dois legados até upgrade oportunista ou lote aprovado, sem inferir donos nem alterar arquivos.

Rollback preferido: interromper a fase seguinte, manter schema aditivo e leitor compatível com hash/snapshots/eventos e reverter somente código compatível. Sem DROP, reconstrução de plaintext ou remoção indiscriminada dos5vínculos; reversão de permissão exige snapshot/pós-CAS e plano próprio que preserve alterações posteriores. Restauração completa do banco remoto é último recurso, fora desta autorização: exige novo plano Vault, backup e consentimento, janela operacional e análise explícita dos dados escritos depois das17:51:45UTC, que seriam perdidos em retorno direto a esse snapshot. A restauração já comprovada foi somente local.

### Texto de consentimento para o Bibble apresentar ao usuário

O código do CheckList e do Portal passou nos testes e revisões locais, incluindo a integração Radar. Para seguir no **staging**, falta sua autorização específica para quatro mudanças no banco: adicionar26colunas/5tabelas/36índices preservando os dados; preparar os3modelos para usos futuros; habilitar CheckList para o Líder Operacional mantendo os4acessos atuais; e converter as2senhas legadas para hash, mantendo a mesma senha de login e sessão. A conversão só será feita após o Portal leitor e o Painel escritor estarem READY, validados no banco staging e sem escritores antigos ativos.

O backup completo de22/10 às14:51:45 deSãoPaulo tem360,8MB e foi restaurado/verificado; continua válido apenas até24/10 às14:51:45, com nova conferência antes de aplicar. Não esperamos perder registros; pode haver bloqueio temporário de escritas durante índices/transações, sem duração medida. A senha em texto claro será removida e não poderá ser reconstruída a partir do hash. Se for necessário recuar, manteremos a estrutura aditiva e um leitor compatível; uma restauração remota do backup teria plano e autorização separados por poder perder dados posteriores. A alternativa é manter staging como está até você aprovar. Produção permanece fora do escopo.

**Você autoriza exatamente essas quatro operações no banco de staging, nos planos acima, condicionadas ao backup válido, préestado/CAS sem divergências e às provas reais de leitor, escritor e cessação antiga antes de converter as senhas?**

A confirmação é exigência expressa do [AGENTS.md](../../AGENTS.md), política de banco: “Sempre solicite confirmacao explicita do usuario antes da alteracao. Silencio, contexto anterior ou aprovacao generica nao contam como consentimento.” A skill [Vault](../../.agents/skills/bibble-squad/vault/SKILL.md), protocolo passo5, exige: “Pergunte se o usuário autoriza exatamente a alteração descrita e aguarde confirmação inequívoca.” O pedido geral de implementação e a pergunta sobre armazenamento não atendem essa confirmação do plano específico. Nenhum bloqueio automático de aprovação foi recebido nesta estação; a pendência vem dessas regras do projeto.

### Relatório de conclusão e File List

✅ Revisão/consolidação documental concluída; backup existente válido na conferência. ⛔ Aplicação aguarda consentimento e pré-condições operacionais; não declarar APROVADO PARA APLICAR, Done ou publicado. Sem novos testes/backup/reconexão SQL, schema/migração/seed/grant/hash, arquivos cloud, Git mutável ou ação em produção nesta estação.

Alterados somente `docs/vault/checklist-analistas-20261022.md` e status/checklist/File List da story `docs/stories/story-checklist-analistas-reformulacao-integracao-crm-20261022.md`; relatório `/tmp/checklist-analistas-20261022-vault-final-plan.md` foraGit. Preservados edits anteriores de Forge na story e matriz QA, roots compartilhados e todo conteúdo histórico. **Controle devolvido ao Bibble; estação Vault encerrada.**

## Vault — consentimento recebido e liberação específica de3operações staging

**Consentimento real recebido: resposta literal “sim” à pergunta “Você autoriza essas quatro operações no banco de staging, conforme esse plano?”.** Captura/primeira observação nesta estação em22/10/2026 **20:16:25UTC**; não é timestamp exato da mensagem nem ID inventado. Transcrição da pergunta/bullets e contexto de riscos fornecidos pelo coordenador, vinculados à cópia integral do plano, backupSHA e planos exatos em `/tmp/checklist-vault-20261022/authorization-20261022/user-consent-record.json`.

**LIBERADAS SOMENTE schema → bootstrap3 → grant5, se os guardas CLI confirmarem o préestado na aplicação. Hash2 consentido, mas NÃO LIBERADO enquanto faltarem provas reais do rollout.** Nenhuma operação de escrita foi executada pelo Vault.

## Revalidação objetiva

- Alvo: exclusivamente banco staging, fingerprint `7fdd160737ba6f9cf84d0ac2fb1c3cf1084311e7fccea454f7bac368f9e4d42b`; env regular0600 explícito `/home/ialpha/.config/painel-alpha/checklist-staging-20261022/database/.env.staging.local`. Nenhum default/root .env.local, produção ou provedor consultado.
- Preflight em transação read-only, somente SELECT/PRAGMA e rollback ao final, em `2026-10-22T20:18:21.690Z`: diagnóstico integral idêntico, NOT_APPLIED/canônico,0bloqueios/FK,4atendimentos/6checklists/10itens/3modelos/2legados válidos,0docs/fotos/Teste e ledger ausente;4owners futurosNULL. Quatro planSHA idênticos ao consentido, sem mudança material.
- SQLSHA `5c9affa7859fe9ea95ccc3e2fa995487ef6ee2c95e35d0063cdc64c01f41948d`,67statements26ADD+5tabelas+36índices. Código MainHEAD584856ebac7760707baf60853b28eb870515b239; gates5958PASS/Portal7d12f74/revisões locais intactos adotados sem repetição.
- Backup existente22/10/2026 17:51:45UTC,360811599bytes/SHA `30b31bbef7c4e462c49bf22150ec4150f6bcc5d4ee035ec47d0fc67197acdd5e`;337tabelas/295932linhas,restore completo íntegro17:54:38UTC,FK0/counts por tabela/schema/seq iguais. Stat/metadata/lineage conferidos, arquivos regulares0600/tamanhos corretos; idade **2.4434h** em `2026-10-22T20:18:21.645861+00:00`. Validade conservadora até24/10/2026 17:51:45UTC. Sem releitura do dump, novo hash360MB, restore ou backup nesta estação. O CLI de apply executará a verificação obrigatória do próprio guard, sem contorno.
- Uma primeira consulta agregada de fotos no harness temporário usou nome de coluna incorreto e falhou sem mutação; corrigida para imagemUrl conforme schema e revalidação concluída. Não representa drift de dados.

## Evidências e comandos exatos prontos para DevOps

Diretório privado0700 `/tmp/checklist-vault-20261022/authorization-20261022`; arquivos0600 foraGit. Somente3pares consent/vault foram emitidos, legitimamente derivados da resposta real e revisão atual; não há aprovação hash nem reader-evidence fabricado. Consentimento geral registra as4operações e condições, preservando a possibilidade de liberar hash após provas reais e prazos ainda válidos, sem pedir novamente o mesmo consentimento.

- `schema`: planSHA `d05371e72b6b6ad54079429c6f52eb60ea01df7f9f066efe794e8f72e50e564f`; consent `/tmp/checklist-vault-20261022/authorization-20261022/consent-schema.json`; Vault `/tmp/checklist-vault-20261022/authorization-20261022/vault-schema.json`.
- `bootstrap-modelos`: planSHA `69b3c4bcf5b727879e6ac7991ac7c1cb12a6a8c367ef43a63f42b9049551c136`; consent `/tmp/checklist-vault-20261022/authorization-20261022/consent-bootstrap-modelos.json`; Vault `/tmp/checklist-vault-20261022/authorization-20261022/vault-bootstrap-modelos.json`.
- `habilitar-lider-checklist`: planSHA `a7b25eff2ac9966fc6df6f54c01a36d9e49158c99c821ae15b66f37d7f1bda4d`; consent `/tmp/checklist-vault-20261022/authorization-20261022/consent-habilitar-lider-checklist.json`; Vault `/tmp/checklist-vault-20261022/authorization-20261022/vault-habilitar-lider-checklist.json`.

Comandos abaixo são destinados à próxima estação DevOps e **não foram executados**:

```bash
cd /home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022
node scripts/checklist-analistas/cli.mjs plan --operation schema --env-file /home/ialpha/.config/painel-alpha/checklist-staging-20261022/database/.env.staging.local --apply --consent /tmp/checklist-vault-20261022/authorization-20261022/consent-schema.json --vault /tmp/checklist-vault-20261022/authorization-20261022/vault-schema.json --backup /home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.sql --manifest /home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.manifest.json
node scripts/checklist-analistas/cli.mjs plan --operation bootstrap-modelos --env-file /home/ialpha/.config/painel-alpha/checklist-staging-20261022/database/.env.staging.local --apply --consent /tmp/checklist-vault-20261022/authorization-20261022/consent-bootstrap-modelos.json --vault /tmp/checklist-vault-20261022/authorization-20261022/vault-bootstrap-modelos.json --backup /home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.sql --manifest /home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.manifest.json
node scripts/checklist-analistas/cli.mjs plan --operation habilitar-lider-checklist --env-file /home/ialpha/.config/painel-alpha/checklist-staging-20261022/database/.env.staging.local --apply --consent /tmp/checklist-vault-20261022/authorization-20261022/consent-habilitar-lider-checklist.json --vault /tmp/checklist-vault-20261022/authorization-20261022/vault-habilitar-lider-checklist.json --backup /home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.sql --manifest /home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022/database-backups/pre-change/checklist-staging-2026-10-22T17-51-45-044Z.manifest.json
```

Depois de schema validar APPLIED/contagens/FKs/preservações, aplicar bootstrap e grant um a um, conferindo o mesmo plano antes e depois. São transações separadas; CAS/drift/erro bloqueia o avanço. Bootstrap preserva itens/snapshots antigos; grant insere5relações do Líder Operacional preservando4tokens anteriores e demais acessos efetivos. Não atribuir donos ou adicionar novos registros ao escopo. Hash posterior exige Portal leitorREADY+testes legítimos/DBproof, PainelhashwriterREADY e cessação operacional de writers antigos; alias sozinho não basta. Sem prova, batch segue bloqueado mesmo com consentimento.

Os riscos, alternativa e rollback continuam os apresentados: locks temporários de duração não medida; nenhum registro deve ser perdido pelo plano aditivo/preservatório; manter schema e leitor hash compatível; restauração remota completa requer plano/consentimento próprios por potencial perda de writes posteriores. Nenhum DROP/rebuild/ledger/dbpush/migratedeploy/Teste/objeto/ownerbackfill/timer/produção integra a liberação. A resposta “sim” não autentica Vercel nem concede promoção de produção.

Saída JSON segura: `/tmp/checklist-vault-20261022/authorization-20261022/authorization-summary.json`; preflight/backup-readiness/planos/evidências citados no JSON. Docs alterados: relatório Vault e status/checklist/File List da story; somente documentação. Edits anteriores de Forge/memória/root preservados. **Controle devolvido ao Bibble para DevOps APPLY3 staging e continuidade do acesso Blob legítimo; estação Vault encerrada.**

## DevOps — aplicação real3 staging concluída,22/10/2026

Consentimento específico real “sim” ao plano de4operações, observado20:16:25UTC, e3liberações Vault em `/tmp/checklist-analistas-20261022-vault-authorized.md` foram usados sem nova solicitação. Executados exatamente os3comandos CLI guardados do authorization-summary, em sequência schema→bootstrap-modelos→habilitar-lider-checklist, cwd explícito MainWT e único env regular0600 `/home/ialpha/.config/painel-alpha/checklist-staging-20261022/database/.env.staging.local`, fingerprint7fdd160737ba6f9cf84d0ac2fb1c3cf1084311e7fccea454f7bac368f9e4d42b. Nenhum default/root env carregado.

| Operação | Resultado real | Início/fimUTC | Duração | PlanoSHA |
| --- | --- | --- | --- | --- |
| schema | applied=true/exit0 | 20:24:30→20:25:15 | 45.378s | d05371e72b6b6ad54079429c6f52eb60ea01df7f9f066efe794e8f72e50e564f |
| bootstrap-modelos | applied=true/exit0 | 20:26:46→20:27:08 | 21.721s | 69b3c4bcf5b727879e6ac7991ac7c1cb12a6a8c367ef43a63f42b9049551c136 |
| habilitar-lider-checklist | applied=true/exit0 | 20:28:17→20:28:40 | 22.709s | a7b25eff2ac9966fc6df6f54c01a36d9e49158c99c821ae15b66f37d7f1bda4d |

Schema aplicou somenteSQLSHA5c9affa7859fe9ea95ccc3e2fa995487ef6ee2c95e35d0063cdc64c01f41948d:67statements26colunas5tabelas36índices aditivos. Bootstrap criou3identidades e vinculou3modelos existentes/versão1. Grant inseriu5relações do role Lider Operacional para1membro atual: chamados/Documentos/UpDocumentos/Extratos/checkList. Quatro módulos preservados e acessos adicionais basecrm/calendarioAlpha continuam presentes; comparação dos conjuntos efetivos antes/depois sem perda. Nenhum role/override/owner alterado.

Cada CLI executou o guard completo ORIGINAL: consentimento/Vault/plano/fingerprint/idade/SHAbytes do dump e restore descartável local/integrity/FKs/contagens. Isso não é novo backup nem restauração remota; não houve otimização/contorno/patch deCLI. Backup original22/10/2026 17:51:45UTC,360811599bytes/SHA30b31bbef7c4e462c49bf22150ec4150f6bcc5d4ee035ec47d0fc67197acdd5e, válido até24/10/2026 17:51:45UTC. Nenhum backup antigo removido.

Pós-verificação READONLY após CADA operação: schemaAPPLIED/canônico/blockers0/FK0; contagens4atendimentos/6checklists/10itens/3modelos/2contas,4ownersNULL,0documentos/fotos/Teste; ledger continua ausente. Campos originais de operacional_clientes/Checklist/ItemChecklist/ModeloItemChecklist comparados em memória contra backup SQLite nativo verificado aberto READONLY: todos iguais nas3fases, sem impressão de linhas/dados privados. Itens/snapshots antigos preservados; novas colunas são única diferença esperada do schema. Plano bootstrap após schema permaneceu69b3c4bc…; plano grant após bootstrap permaneceu a7b25eff…; CAS/approval não foram recalculados para contornar diferença. Final20:28:57UTC, schemaFingerprintda7d0fa7e224b201b24cae15b5d0cc510e01015976807d64c9839f02b0807035;3identidades/3vínculos e5permissões exatas. Hash2 NÃOexecutado;2legados continuam aguardando rollout leitor/escritor/cessação antiga e liberação correspondente.

### Blob após autenticação real: step-up ainda exigido

Usuário confirmou novo loginoficial device NNBF-QNBR; CLI64.0.2isolada terminouexit0 e gravou auth600 no diretório0700 já separado. Identidadeesperada e equipe team_Ct0FhLD6LFla3xec3SWlW7QC conferidas legitimamente viaAPI antes do uso. GETsecrets do store privado novo store_IZKjlrpAjL248Ofn apósloginreal,20:27:38UTC, continua403challenge_required. Nenhum segredo recebido/configurado, nenhuma conexão genérica/default/production/preview ou exportação por logs/functions/env. CHECKLIST_PRIVATE_BLOB_TOKEN continua ausente nos2customstagings. Nenhuma tentativa repetida nem troca de globalBlob. OAuth concluído NÃOequivale a step-up liberado.

Próxima ação humana: abrir [Vercel Storage](https://vercel.com/dashboard/stores), selecionar CHECKLIST-STAGING-20261022 e concluir confirmação de identidade solicitada para acesso à credencial privada; não enviar token pelo chat. Provedor é autoridade sobre a liberação. Isolatedconfig `/home/ialpha/.config/painel-alpha/checklist-staging-20261022/vercel-login`, sessão98091 já concluída; código expirável não precisa ser reutilizado. Não repetir login como substituto presumido de step-up.

### Estado e próximos passos

Gates Main da árvore584856eb: TC8GiB/lint0erros1183warn/full737arquivos5958PASS+4skip1todo/build62,06s PASS adotados deForge-merged. Portal7d12f74 intacto mantém TC/lint/build57+3tests. Somente documentação editada aqui, sem repetir gates íntegros. Nada publicado/push/PR remoto/main/prod; não háPortalstagingREADY, runtimebinding/TLS/origins nem homologação autenticada comprovados. Resolver credencial privada legítima, preparar rollout SOMENTEstaging, anunciar internamente antes do push; PortalreaderREADY primeiro→PainelhashwriterREADY+cessação comprovada de writers antigos→liberaçãoVault hash2 já consentido→homologação privada/polling. Sem nova pergunta para o mesmo consentimentoDB, salvo mudança material de plano/escopo/validade.

Sem DROP/rebuild/dbpush/migratedeploy/ledger/manualSQL/batch/Teste/ownerbackfill/objeto/timer/Pusher/prod. Polling§14 exclusivo, timer suspenso. Story In Progress. Handoff `/tmp/checklist-analistas-20261022-devops-apply3.md` e JSON seguro correspondente contêm comandos/exits/time/SHAs/logs/preservação e distinção entre aplicado e pendente. Logs CLI `/tmp/checklist-analistas-20261022-devops-apply3-{schema,bootstrap-modelos,habilitar-lider-checklist}.log[.json]`; pós-verificações `...-post-<op>.json`; acesso provider `...-blob-auth.json`. Sem segredos nesses relatórios. Controle devolvido ao Bibble.

## DevOps — Portal PUBLICADO em staging; Main aguarda integração concorrente,22/10/2026

PortalSHA7d12f74d7de2895d49a4ea1b2356cef39427ea64 enviado exclusivamente refs/heads/staging às20:50:55UTC, gitpushexit0. Deploymentdpl_HQ3FpQfbJtCCUJCuuDXBdziYGW8z READY2026-10-22T20:51:51.743000+00:00, customEnvironmentIdenv_qYFh0wPmnBMHkAN0Q3sWKeR7aYHW, gitSource.refstaging/shaexato, targetnull(nãoproduction). BuildrealVercelCompiled9,3s/Completed38s, semerro; build ignora tipos como configuraçãoexistente, TS separado previamenteaprovado. Nenhum gate local íntegro repetido.

Aliasesclientes-staging.alpha-comex.com ealphaclientes-env-staging-alpha-comexs-projects.vercel.app apontamparaesse Portalnovo;domínioverified/custoenvcorreto/TLSv1.3hostnamevalidado/certaté20/01/2027. **Smokes anônimos/login,/redefinir-senha,/checklist,/api/notificacoes retornaram302SSOvercel.com/sso-api**, sem observar aplicação protegida. Não são500app nem prova de app200/callback307/API401; não háNextAuthsessãoforjada/seeds/E2Eautenticado. SSOall_except_custom_domainspreservado.

CLIoficial64 `vercel curl` foiinspecionada: ausência deautomation-bypassexistente fariaautomaticamentePATCHdecredencial porPROJETO. Metadatareadonlycomprovouausência dessebypass noPortal; comando nãoexecutado paraevitaralterarproteção/credencialprojectwide/produção. NenhumSSOglobaldesativado oucookieextraído. Provareader serácompletada peloVault/QA comautenticação legítima; nenhumreader-evidencevalidatedtruefabricado.

ApósREADY+hostTLS, origemMainconfigurada: NEXT_PUBLIC_CHECKLIST_PORTAL_ORIGIN=https://clientes-staging.alpha-comex.com, IDBzqUwB7MEWf6YeMB, encrypted,target[],gitBranchnull,customEnvironmentIds[env_sKT0JOh0HB03g20jmcqN5pTHMjqT], API201às20:54:41UTC. Todosoutrosrecordsremotosintactos. NoarquivoCLIstage dedicado regular0600 somenteCHECKLIST_PORTAL_ORIGIN foiadicionado; demaislinhas/modos preservados. Rootenvfornecidopelousuáriointacto. Blobprivadofornecido store_TMoeHVov3GTce7R5 e2runtimekeysstage configurados anteriormente permanecem; envmetadatafreshconfirma DB/auth/Blob/proofs exclusivamente2customscopes. FontePortalPrisma lêTURSOURL/token;knownstagefingerprint7fdd1607… porlineage/envscopes, não porprocess.envremotoobservado.

**Main NÃOpublicado porDevOps:** prepushdetectouorigin/staging04cc69c0b716dc340ad0a3f63670406bbe631f98,READYdpl_HjFuQU8XuyW414YbVMyA2qasuNb9. Emvezdesobrescrever, pushMain/merge suspensos paraScout/owners. NossaHEADa70449d8/source584856eb preservadas. Deltaab278→04cc43commits/178paths; como16jácompartilhados,nova ancestralidadeMain↔04cc tem2mergebasesab278+d758,5nossos/27remotosúnicos e119pathsremotosúnicos.10overlaps exatos:

- prisma/schema.prisma
- src/actions/bpm/Cards.ts
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx
- src/components/layout/CentralNotificacoesPainel.tsx
- src/components/layout/PainelLayoutClient.tsx
- src/hooks/useBpmCardNotificacaoNavigation.ts
- tests/bpm/edicao-campos-card.test.ts
- tests/bpm/tarefas-alertas-central-react.test.ts
- tests/bpm/tarefas-alertas-foco-react.test.ts
- tests/bpm/tarefas-notificacoes-navegacao-react.test.ts

BrevePrismadeltaab→04cc:somenteCliente.perfilCadastralJson Json? novo;nenhummodelonovo/removido. Isso nãoautoriza novaDDL; merge/source/contratoparity/gatesafetados pertencemaosownersseguindoScout. JSONdrift contém27SHAs/títulos/paths/parentsbase; nenhuma análiseprofunda/mergeautomático nestaestação.

3aplicaçõesDB anteriores continuam registradas/APPLIED; nenhum novoDBwrite/backup/hash/owner/Teste/objeto/timer/produção nestaestação. As47versõesantigas NÃOforamprotegidas/excluídas; inventárioprecisarefresh após publicação subsequente. Hash2permanececondicional aoPortalreadercomprovado/MainhashwriterREADY/cessaçãoreal(drain/skew/rotas)/Vault; aliasnãoéprova. Estado: **Portalpublicadoemstaging; Mainpendenteintegração; homologaçãoautenticadae hashcondicionalpendentes**, StoryInProgress. SemDone/promoçãoprod.

FileListDevOps:runbookops,relatórioVault e story porappend; sem app/testes/schema/dependênciasalterados. Handoff `/tmp/checklist-analistas-20261022-staging-published.md`/`.json`, logsPortalpush/build/status/HTTP/origin/drift/protectioncapability foraGit, semsegredos. Fontes/roots/dadosaplicados/memórias4dirtyanteriorespreservados. ControledevolvidoaoBibbleparaScout/ownersMain.


### DevOps — publicada em staging; homologação autenticada/hash condicional pendentes (22/10/2026)

- [x] Portal87ca1656 READY dpl_HwPxcDe4TyJAUZTTtr2cHPhnKubS antesMain37a7048d READY dpl_35EMmv9TsVEZrbBiJD9KwYZm5Tky. Mainfontea54152be inalterada+2docsForge/Lens. Refstaging/customIDs exatos,2aliases porapp/TLS válidos.
- [x] Main smokes200/307auth/401/200listasvazias; Portal302SSOVercel preservado. MainOOM8GB recuperadoUMAvezTurbo por deployment30cores60GB/ativo182.098s; semconfigglobal. Blobprivado/config2stages eDB3applies anteriores porlineage.
- [ ] Homologação autenticada/uploadreal/hash2 pendentes;48oldwriters preservados, semprova decessação/drenagem. SemDELETE/proteção/DBwrite/objetos/timer/produção nestaestação. StoryInProgress, nãoDone.

Handoff `/tmp/checklist-analistas-20261022-staging-published-final.md`+JSON; plano48IDs `...-publish-final-oldwriters.json`. FileListDevOps: storyChecklist, docs/ops/checklist-analistas-staging-20261022.md, docs/vault/checklist-analistas-20261022.md, docs/qa/matriz-checklist-analistas-20261022.md; appenddocs local semnovo pushduplicado. ControleaoBibble.
