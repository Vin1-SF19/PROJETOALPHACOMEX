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
