# Contrato de dados — CheckList Analistas / CRM

Dara, 22/10/2026. Bases: Painel `69047dee`, Portal `edcf2e8e`. Implementação de artefatos nos worktrees da story; **não aplicada a banco real**. Fonte normativa: `docs/architecture/checklist-analistas-crm-20261022.md`. Nenhum `.env.staging.local` foi carregado durante esta fase.

## Entregue

- Schema canônico completo do Painel espelhado no Portal; ambos Prisma6.19.3 validam e geram cliente. O Portal deixa de descrever o layout antigo, mas as actions/UI/auth ainda devem ser adaptadas por Echo/Nova. Não executar migrate/db push no Portal.
- Migration `20261022143000_checklist_analistas_crm`: cinco tabelas novas, colunas/índices aditivos nas existentes e FKs nullable inline. Não contém rebuild de tabela, DROP, RENAME, INSERT/UPDATE/DELETE ou desligamento de FKs. O SQL originalmente sugerido pelo Prisma reconstruía tabelas; foi substituído por ALTER ADD preservando estruturas existentes. Equivalência de colunas/índices/FKs conferida com SQLite sintético contra DDL do schema Prisma.
- CLI padrão dry-run, diagnóstico sem PII, plano de bootstrap de modelos/Teste/storage, validação e plano de rollback. `--apply` guardado para uso posterior autorizado; não invocado nesta entrega.
- Contrato hash `prisma/checklist-schema.contract.json` e verificador estático nos dois repositórios. Mudança de schema exige regenerar os DOIS contratos após revisão; nunca atualizar hash para ocultar divergência.

## Nomes Prisma fechados para Echo/Nova

| Entidade | Campos/relações novos e significado |
| --- | --- |
| `OperacionalClientes` | `analistaId Int?`, relação `analista`, `revision Int @default(0)`; `eventos`, `recibos`, `vinculosCrm`. FK owner → usuarios.id, SetNull. Índices owner+createdAt+id, conta e criação. |
| `ClienteOperacional` | `senhaHash String?`, `authSessionVersion Int @default(0)`, `resetSenhaTokenHash String? @unique`, `resetSenhaExpiraEm DateTime?`; `checklistUploads`, `checklistRemocoes`, `checklistRecibos`, `checklistEventos`. `senha String` legada preservada. Novos hashes usam senha vazia. |
| `ModeloChecklistIdentidade` | `id`, `escopo String` (`GLOBAL` ou TipoEmbasamento), `codigoNormalizado String`, `revision Int @default(0)`, `autorId Int?`, `autor`, `revisoes`, `createdAt`, `updatedAt`; unique escopo+codigoNormalizado. CAS próprio do catálogo nessa identidade. |
| `ModeloItemChecklist` | `identidadeId String?`, `identidade`, `versao Int @default(1)`, `ativo Boolean @default(true)`, `ordem Int @default(0)`, `autorId Int?`, `autor`, `itensSnapshot`; unique identidadeId+versao. Cada revisão é uma linha imutável com id próprio. |
| `Checklist` | `modelosSnapshot Json?`: manifesto das revisões materializadas, sem alteração na leitura. |
| `ItemChecklist` | `modeloRevisaoId String?`, `modeloRevisao`, `ordem Int @default(0)`, `recibos`; FK nova → ModeloItemChecklist.id, Restrict. **`modeloItemId` antigo continua intacto e sem FK nova**, evitando backfill/inferência/DDL destrutivo. Novas instâncias preenchem `modeloRevisaoId`; os campos existentes codigo/secao/descricao/obrigatorio e ordem são snapshots. |
| `DocumentoChecklist` | `storageProvider`, `storageKey`, `storageAccess`, `tamanhoBytes Int?`, `mimeType`, `sha256`, todos nullable para legado; `uploadedByUsuarioId Int?`, `uploadedByContaId String?`, `deletadoPorUsuarioId Int?`, `deletadoPorContaId String?` e relações correspondentes sem sufixo Id; `recibo` opcional. Flags/URL/deletadoEm legados preservados. |
| `ChecklistUploadRecibo` | `id`, `tokenHash @unique`, `empresaId`, `empresa`, `itemId`, `item`, `usuarioId Int?`, `usuario`, `clienteOperacionalId String?`, `clienteOperacional`, `storageProvider`, `storageKey`, `storageAccess @default("private")`, `nome`, `tamanhoBytes`, `mimeType`, `sha256?`, `expiresAt`, `consumidoEm?`, `documentoId? @unique`, `documento`, `createdAt`, `updatedAt`. Unique provider+key. Token cru nunca persistido. |
| `ChecklistCrmVinculo` | `id`, `cardId @unique`, `card`, `empresaOperacionalId`, `empresaOperacional`, `revision @default(0)`, `autorId?`, `autor`, `createdAt`, `updatedAt`. Registro não tem unique por empresa; vários cards reutilizam atendimento. BpmCard recebe `checklistDocumentalVinculo?`. Excluir vínculo não exclui atendimento. |
| `ChecklistEvento` | `id`, `mutationId @unique`, `payloadHash`, `agregadoTipo`, `agregadoId`, `revision`, `tipo`, `empresaId?`, `empresa`, `atorTipo`, `atorUsuarioId?`, `atorUsuario`, `atorContaId?`, `atorConta`, `dados Json?`, `resultado Json?`, `createdAt`, `publicadoEm?`, `tentativas @default(0)`, `proximaTentativaEm?`, `claimToken?`, `claimAte?`, `ultimoErro?`, `leituras`, `notificacoes`, `auditoria?`. Unique agregadoTipo+agregadoId+revision e índice outbox. |
| `ChecklistEventoLeitura` | `id`, `eventoId`, `evento`, `usuarioId`, `usuario`, `lidoEm`; unique evento+usuário, índice usuário/data. |
| `NotificacaoCliente` | `eventoId String?`, `evento`; unique eventoId+clienteId. NULL permite notificações antigas sem colisão. Leitura externa `lida` permanece separada da interna. |
| `Auditoria` | `checklistEventoId String? @unique`, `checklistEvento`; autoria interna existente permanece obrigatória. Evento portal usa journal, sem inventar usuario interno. |

Relações reversas em `usuarios`: `checklistAtendimentos`, `checklistModelos`, `checklistIdentidades`, `checklistUploads`, `checklistRemocoes`, `checklistRecibos`, `checklistEventos`, `checklistEventosLidos`, `checklistVinculosCrm`.

Campos `atorTipo`, `agregadoTipo`, `escopo` e `storageAccess` são Strings no banco SQLite. Echo valida whitelists/invariantes, actor XOR, ownership e payload no servidor; a existência das FKs não implementa ACL. Não há RLS nativo nesta base SQLite/Turso. Leitura global autorizada e escrita owner/líder devem ser conferidas novamente na transação e em cada endpoint.

## Contratos de comando e snapshots

- Atendimentos: CAS `updateMany({where:{id,revision:expectedRevision},data:{revision:{increment:1},...}})` dentro da mesma transação do evento/auditoria/notificação. A revisão confirmada consta no evento. O unique agregado+revision protege duplicidade; mutationId+hash identifica replay da mesma intenção. Usar `agregadoTipo="ATENDIMENTO"`, id operacional. Novo mutationId pode criar outro atendimento do mesmo master/conta; não existe unique por empresa.
- Catálogo: CAS por `ModeloChecklistIdentidade.revision`. `agregadoTipo="MODELO"`, agregadoId identidade. Publicar nova revisão em ModeloItemChecklist, desativar publicação anterior para novas instâncias; não editar snapshots antigos. `versao` da revisão e `revision` CAS têm responsabilidades diferentes. Código normalizado sugerido, compartilhado com CLI: NFKD, retirar marcas, trim, uppercase, sequências não A–Z/0–9 viram `_`, retirar `_` nas bordas, 1–80 caracteres. Echo deve usar a MESMA função/regra e teste de paridade.
- Vínculo CRM usa `agregadoTipo="VINCULO_CRM"` e CAS do vínculo/card pelo contrato Aria. Desvinculação deixa evento com agregadoId textual; não há FK obrigando manter a linha de vínculo. Revalidar Cliente.id de ambos recursos na transação.
- Campos Json `dados`/`resultado` guardam somente antes/depois e DTO mínimo seguro. Nunca senha/hash/token/storage key/URL privada/conteúdo de documento. A10 não fecha só com metadata.
- Recibo pertence simultaneamente ao atendimento/item e a um ator interno OU conta; Echo verifica coerência entre todas as FKs, consumo/expiração/CAS e tamanho/MIME/magic bytes. Retry retorna documento persistido pelo mesmo recibo sem criar outro. O schema sozinho não autoriza upload nem materializa arquivo.
- O enum preserva os 11 valores: nove canônicos e `FALAR_DR_EDVAN`, `FALAR_ANDREW` somente legados. Não oferecer os dois em novas escolhas. Só OK/DESNECESSARIO completos; UI/helper são responsabilidade Echo/Nova.

## CLI, diagnóstico e execução futura

Sem conexão, sem carregar env:

```sh
node scripts/checklist-analistas/cli.mjs plan
node scripts/checklist-analistas/cli.mjs rollback
node scripts/checklist-schema-parity.mjs
```

Fixtures locais descartáveis, somente leitura:

```sh
node scripts/checklist-analistas/cli.mjs diagnose --database-url file:/tmp/fixture.db
node scripts/checklist-analistas/cli.mjs plan --operation bootstrap-modelos --database-url file:/tmp/fixture.db
node scripts/checklist-analistas/cli.mjs plan --operation limpar-teste --database-url file:/tmp/fixture.db
node scripts/checklist-analistas/cli.mjs plan --operation storage-legado --database-url file:/tmp/fixture.db
```

Staging futuro usa `--env-file /caminho/.env.staging.local` explícito. Variáveis de prova esperadas: TURSO_DATABASE_URL/TURSO_AUTH_TOKEN, CHECKLIST_TARGET_ENVIRONMENT=staging, CHECKLIST_PANEL_ORIGIN=https://staging.alpha-comex.com, CHECKLIST_STAGING_DATABASE_SHA256=sha256(URL exata). Não são criadas/configuradas por esta entrega. URLs/tokens/PII nunca entram no relatório; apenas fingerprints/IDs/counts. Mapeamento antigo bloqueia com LAYOUT_MASTER_INCOMPATIVEL, sem inferir conta/master por CNPJ.

`diagnose` verifica layout, fase NOT_APPLIED/PARTIAL/APPLIED, órfãos de master/conta/checklist/item/documento/modelo legado, status desconhecido, colisões de modelo e counts. Estado parcial bloqueia aplicar. Catálogo usa cursor de250; não trunca silenciosamente em500. Colisões de código por escopo exigem resolução explícita; duas revisões da mesma identidade não são colisão. Unique com identidade nullable permite preservar homônimos antigos sem fusão automática; novos comandos não devem contornar a identidade. Objetos/contas/pastas com dados divergentes exigem outra aprovação.

`--apply` somente no comando plan, somente com env staging explícito e operação schema/bootstrap-modelos/limpar-teste; exige arquivos --vault/--consent/--backup/--manifest. Gate exige ambiente+fingerprint+operação+planSha256+backupSha256 correspondentes. Consentimento deve vir do usuário, confirmado/identificado e <=48h; não gerar aprovação sintética para executar em ambiente real. Manifesto de backup existente usa generatedAt/databaseHash/sizeBytes/tables/totalRows/sha256; dump é restaurado em SQLite local para integrity/FK/counts. Backup vazio, vencido ou divergente é recusado. Vault define procedência e escopo do backup antes de qualquer aplicação.

Consent/Vault JSON precisam environment="staging", databaseFingerprint, operation, planSha256 e backupSha256; Vault approved=true; consent confirmed=true, confirmedBy="user", confirmedAt. Isso é formato de evidência, **não substitui a apresentação do plano e a confirmação específica na conversa**. Nenhum arquivo desses foi fabricado nesta fase. `applyPrepared` usa transação, recalcula plano, valida pósestado/FKs e rollback na falha.

Migration é única do Painel para banco compartilhado; Portal NÃO tem migration independente. Script aplica/verifica estrutura e não manipula ledger `_prisma_migrations`. DevOps/Vault devem avaliar histórico existente e registrar `migrate resolve --applied` específico somente quando pertinente/autorizado; nunca `migrate deploy` cego sobre histórico divergente.

## Legado, limpeza e rollback

- Owner NULL e pastaChecklistId preservados. Nunca derivar analista do nome da pasta, nome de pessoa ou CNPJ.
- Teste: plano identifica apenas nome exato `Teste`, IDs/counts de empresas/checklists/documentos. Após autorização específica: desligar pasta das empresas e remover somente a linha da pasta dentro de transação; não excluir atendimento/arquivo/checklist. “Sem Pasta” é filtro virtual, não alvo SQL. Dados afetados/IDs formam hash do plano; mudou o conjunto, precisa revisar aprovação.
- Bootstrap de modelos é fase separada autorizada depois do DDL. Adiciona identidade/revisão somente às linhas de catálogo; mantém itens antigos e sem propagação. Não une identidades existentes nem escolhe vencedor de colisão. Autor desconhecido permanece NULL; não forjar autoria interna.
- Storage legado só tem plano/counts; nenhum payload é lido, copiado, hashado ou removido. Inventário por objeto/checksum, cópia privada/invalidação originais e controles do Portal dependem de DevOps/Vault em outra fase explícita.
- Rollback preferencial: reverter código somente para leitor compatível com novas colunas, hashes e eventos, mantendo schema aditivo. Nunca voltar ao autenticador exclusivamente plaintext após conta hash. Sem DROP automático. Restore completo exige novo plano/backup/consentimento e análise dos writes posteriores. Nenhum backup real foi gerado por esta fase.

## Evidência executada e limites

- Prisma validate/generate Painel e Portal: PASS,6.19.3.
- Painel `vitest run tests/checklist-analistas/schema.contract.test.ts`:14 PASS; SQLite real descartável, FK/CAS/uniques/cardinalidade/snapshots/11status, equivalência DDL canônico, diagnóstico sem mutação, Teste/storage somente plano e CLI fail-closed.
- Portal `node --test tests/checklist-schema-parity.test.mjs`:3 PASS; contrato/hash, schema divergente recusado e Prisma Portal lendo11status em SQLite descartável.
- Verificador Portal `--panel-schema <schema Painel>`: PASS, igualdade integral dos schemas. SHA contrato: b407823eda5407077f58ca75c3751386a9e9b544f1022eaa08dd2edb37443220.
- ESLint dos scripts/testes novos nos dois repositórios: PASS. Dependência local opcional Portal @libsql/linux-x64-gnu0.5.29 estava ausente e foi copiada de instalação independente da MESMA versão já presente no lock; só node_modules, sem package/env/lock alterado.
- Não executados nesta fase: gates globais de aplicação, auth/actions/UI dos dois apps, E2E autenticado, migração/aplicação real, bootstrap/limpeza/hashes/objetos reais, configuração de staging ou deploy. Echo/Nova/Sage/Forge/Probe/Anubis/Lens e Vault/DevOps seguem obrigatórios. Estes testes de dados não aprovam o sistema completo.

## Estação Dara2 — operações faltantes preparadas, sem aplicação real

Base local a950f33e, preservando merge d7580d07 e fontes Echo/Nova/DevOps. A fotografia operacional recebida é read-only: staging canônico NOT_APPLIED,2 contas legadas,3 modelos sem conflito,0 documentos/fotos/Teste e líder sem checkList. Esta estação não repetiu conexão/diagnóstico remoto, não leu env real, não criou backup real e não aplicou schema/dados/configuração/deploy. O preflight não substitui o diagnóstico imediato anterior à futura execução.

Arquivos: novo `scripts/checklist-analistas/operations.mjs`; extensão de `lib.mjs`/`cli.mjs`; `tests/checklist-analistas/operations.test.ts`, `fixtures/permissions.sql` e declaração mínima `node-sqlite.d.ts` para runtime Node24 com typings Node20 existentes. Schema e contratos de paridade não foram alterados.

### `hash-contas`

```sh
node scripts/checklist-analistas/cli.mjs plan --operation hash-contas --database-url file:/tmp/fixture.db
```

O plano exibe somente IDs opacos, estado LEGACY/HASHED/INVALID, contagens, versão de sessão e política; nunca senha, senhaHash, tokens, URLs nem digests individuais de segredo. O hash geral do plano inclui metadados seguros, não o segredo. Antes do DDL o plano é uma **projeção explícita pós-DDL**: coluna futura senhaHash=NULL e authSessionVersion=0. Somente aplicar o DDL mantendo os dados produz o MESMO planSha256; mudanças nos IDs/estados/versões invalidam o plano. Assim Vault pode revisar plano concreto antes da migration, sem aplicar DDL real para obter a projeção. Estado parcial é recusado. Recalcular e conferir o hash após o DDL antes de aplicar contas.

Após gates, captura credenciais originais somente em memória, calcula bcrypt fator12 antes de abrir a transação de escrita e executa CAS por id+senhaHash original+senha original+authSessionVersion. Hash e limpeza senha='' ocorrem no MESMO UPDATE/transação. Hash existente válido com senha vazia é pulado, sem reset ou recálculo. Hash inválido, legado vazio ou >72bytes (truncamento bcrypt) bloqueiam com código seguro. Hash já existente acompanhado de cópia legada não vazia exige revisão explícita (`HASH_COM_COPIA_LEGADA_EXIGE_REVISAO`): não sobrescrever hash atual nem declarar texto eliminado sem ação. Não há nova operação de limpeza implícita.

Login oportunista, reset ou troca de senha entre captura e commit causam conflito; a transação reverte TODAS as conversões desse lote e preserva a alteração concorrente. Falha de um registro também reverte todo o lote. Saída de sucesso: converted/skipped/conflicts/code, sem material de credencial. Falha inesperada é `HASH_BATCH_FALHOU` com converted0; driver/SQL não escapam no CLI. Reexecução com plano atual já convertido retorna converted0/skippedN. A mesma aprovação anterior não autoriza um plano diferente.

**Sessões:** preservar authSessionVersion, pois converter a representação da mesma senha não troca a credencial nem exige logout. CAS inclui a versão para preservar revogações/resets concorrentes. Não incrementar/resetar esse valor, não restaurar senha antiga e não voltar ao leitor exclusivamente plaintext depois da conversão.

**Ordem obrigatória real (arquitetura §14):** schema aditivo/bootstrap3/grant5 → leitor Portal compatível no staging, READY e validado → escritor Painel de hash novo READY e cessação verificável do escritor plaintext antigo → hashbatch legado → validação journal/polling sem timer. A cessação do escritor antigo é gate operacional externo; o CLI continua validando a evidência do leitor, sem automatizar essa cessação. O apply de hash exige `--reader-evidence <arquivo>` e CHECKLIST_PORTAL_ORIGIN explícito, HTTPS de staging. Evidência futura DevOps deve conter environment="staging", origin exato, databaseFingerprint, deploymentId real dpl_..., commitSha real40hex, readyState="READY", validated=true, checkedAt<=24h e checks hashLogin/legacyUpgrade/sessionVersion=true. Host/origin, destino, estado, data ou checks divergentes bloqueiam. Não fabricar aprovação ou prova de deploy; fixtures sintéticas dos testes não são evidência operacional. Portal atual de produção e preview herdando produção são recusados. A prova verificada em memória expira no menor prazo de backup/consentimento48h e leitor24h.

### `habilitar-lider-checklist`

```sh
node scripts/checklist-analistas/cli.mjs plan --operation habilitar-lider-checklist --database-url file:/tmp/fixture.db
```

Escopo fixo **todos os membros atuais e futuros da role exata Lider Operacional**, incluindo inativos na análise. Sem flags para outro role/usuário e sem criar setor, role, módulo ou override. Requer uma única entrada cadastral equivalente ativa; divergência cadastral deve ser resolvida explicitamente antes. Regra de escrita owner/líder do CheckList não é alterada por esta operação.

Cria exatamente5 vínculos SetorPermissao: chamados,Documentos,UpDocumentos,Extratos,checkList. **UpDocumentos é token legado ausente do MODULOS_REGISTRY atual:** preservar o token não significa afirmar que existe módulo navegável ativo com esse nome. Os outros quatro vínculos correspondem a permissões do catálogo atual. Não introduzir entry de registry nem descartar o token. O resolver real foi testado antes/depois: os quatro tokens previamente efetivos permanecem e checkList é adicionado; role Comercial permanece intacta.

Snapshot/CAS inclui todos os usuários normalizados desse role, mesmo inativos, com id/role/status/permissoes, todas suas linhas de override (somente em hash do snapshot), cadastro do setor, TODAS suas linhas setoriais e catálogo completo/fontes do registry/resolver/roles. Campos pessoais, senhas e conteúdo de motivo não aparecem no plano. Variante de role que a resolução exata não cobriria, fallbacks diferentes dos4 tokens aprovados, múltiplos fallbacks incompatíveis, override removendo acesso requerido ou estado setorial parcial/diferente bloqueiam. Não fazer união automática de novos módulos nem reescrever overrides.

Na transação, reler snapshot, conferir hash do plano e inserir5 relações; pós-validar preservação de acessos+checkList. Falha em qualquer vínculo reverte todos. Estado já configurado exatamente com5 e acessos válidos é no-op. Mudar role, status, permissões, vínculo setorial, override ou catálogo após aprovação exige novo plano. Não mudar usuarios.role/permissoes, dono, revisão de atendimento, sessão ou override individual.

### Gates e execução futura

As duas operações usam `assertApplyGates`: ambiente staging/fingerprint/origin, Vault, consentimento específico e dump completo<=48h restaurado localmente para conferir SHA/bytes/integridade/FKs/counts. Prova verificada é ligada à operação/planSha256, expira e só vale no processo que realmente verificou os arquivos; `{verified:true}` fabricado não passa. Não existe --force. `--apply` continua exigindo caminho absoluto .env.staging.local, agora arquivo regular0600 sem symlink e<=64KiB, sem fallback para .env.local/process.env. O CLI só entrega códigos públicos e contagens, nunca erro arbitrário do driver.

Para execução remota futura, substituir apenas a opção de fixture por `--env-file /caminho/.env.staging.local` na fase de plano. Apply acrescenta --apply/--consent/--vault/--backup/--manifest e, em hash-contas, --reader-evidence. Vault/DevOps preparam os arquivos reais, ligam hashes e apresentam o plano ao usuário; esta documentação NÃO é consentimento. Não houve criação/configuração desses arquivos operacionais nesta estação.

No staging fotografado não há motivo para copiar/revogar objetos ou apagar Teste. Esses comandos permanecem sem aplicação e não devem entrar na autorização real só porque existem na CLI. Não há backfill automático de owner. Rollback de permissão requer snapshot original, conferência pós-CAS e novo plano para preservar mudanças posteriores; não apagar os5 vínculos indiscriminadamente. Hashbatch não reconstrói plaintext: manter leitor compatível ou recuperação completa Vault considerando writes posteriores.

### Evidência focada Dara2

- `vitest run tests/checklist-analistas/operations.test.ts`:17 PASS; SQLite real descartável em /tmp, bcrypt12, transações/CAS/rollback, replay, gates com backup sintético restaurado, reader-proof e resolver REAL de módulos apoiado em Prisma/SQLite.
- Executados juntos com contrato anterior:2 arquivos,31 testes PASS. Testes cobrem líder ativo/inativo, preservação de owner/revisão, outros roles, partial/drift/fallback divergente/override/no-op, planos pré/pós-DDL sem mutação e sem segredo.
- ESLint dos3 scripts e testes/declaração novos:PASS, sem diagnósticos. TypeScript estrito focado via `/tmp/checklist-dara-operations-tsconfig.json`:PASS. Node --check3scripts:PASS. diff-check:PASS.
- Paridade estática Painel e Portal --panel-schema:PASS, SHA schema inalterado b407823eda5407077f58ca75c3751386a9e9b544f1022eaa08dd2edb37443220.
- Nenhum gate global, login real, upload, schema/mutação/backup real, alteração de ambiente, commit/push/deploy foi executado. Sage/Forge/Vault e demais revisões permanecem obrigatórios.


### Vault — revisão e backup,22/10/2026

Revisão independente e backup staging completo verificado concluídos; relatório normativo operacional `docs/vault/checklist-analistas-20261022.md`. Contagem SQL correta:26ADD COLUMN+5tabelas+36índices explícitos=67statements; Prisma diff automático com7rebuilds/DROP NÃO APLICAR. Dump337tabelas reais/295932linhas/949índices/2triggers,360811599bytes, SHA25630b31bbef7c4e462c49bf22150ec4150f6bcc5d4ee035ec47d0fc67197acdd5e; captura17:51:45UTC e restore íntegro17:54:38UTC,22/10/2026. Per-tablecounts/schema/sequências iguais; arquivos ignored700/600. Nenhuma aplicação real autorizada.

PlanosCLI reais dry-run schema/bootstrap3/grant5sem blockers;2legados válidos,0>72bytes,Teste/docs/fotos0,ledgerausente,owners4NULL. Plano hash-contas deve corrigir rótulo de fase e recalcular hash ANTES aprovação/apply. Ordem vigente arquitetura§14: schema/bootstrap/grant→Portal leitor validado→Painel hashwriter novo+cessação verificável do antigo→hashbatch→polling. CLI valida reader; cessação writer é gate operacional externo, não inventar prova de URLs antigas bloqueadas. Timer NÃO instalar/habilitar no transporte polling.

File List desta estação: `docs/vault/checklist-analistas-20261022.md`, append destes documentos e `docs/ops/checklist-analistas-staging-20261022.md`; backup/manifestos/planos privados ficam fora Git. Status In Progress e gates globais/revisões/consentimento/aplicação pendentes.


### Dara — fechamento da fase hash,22/10/2026

Correção de metadado concluída: phase=`AFTER_SCHEMA_BOOTSTRAP_GRANT_AND_VALIDATED_PORTAL_READER_AND_READY_PANEL_HASH_WRITER_AND_LEGACY_WRITER_CESSATION`. Ordem normativa §14: schema/bootstrap3/grant5 → Portal leitor READY validado → Painel escritor hash READY e cessação verificável do plaintext antigo → hashbatch legado → journal/polling sem timer. O CLI mantém apenas o guard reader existente; cessação writer continua gate operacional externo.

Novo planSha256 `hash-contas`: `1bd13b1afa8b4d27abd0745db15619a6583166c5b36bda98622ca5aea806254c`; dry-run real staging às18:06:46UTC de22/10/2026,2conversões projetadas/0inválidas/0bloqueios/0mutações. Plano privado0600: `/tmp/checklist-vault-20261022/plans/hash-contas-phase-corrected.json`; resumo seguro0600: `/tmp/checklist-vault-20261022/hash-contas-phase-summary.json`. Diagnóstico idêntico ao anterior; operationPlan difere somente em phase. Hash antigo3264ef79… continua histórico, NÃO USAR PARA APPLY.

Os registros anteriores de pendência são históricos e ficam superados apenas neste rótulo/planSha; sem alteração de SQL, guards, algoritmo, flags ou schema. ESLint focado PASS; operações existentes17/17 PASS; nenhum teste de espelhamento acrescentado. Backup e demais3planos não foram repetidos. Gates globais/revisões/consentimento/aplicação permanecem pendentes. File List: `scripts/checklist-analistas/operations.mjs`, este documento, `docs/vault/checklist-analistas-20261022.md`, `docs/ops/checklist-analistas-staging-20261022.md` e story correspondente.
