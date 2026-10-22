# Vault — promoção integral para produção (2026-10-22)

Story: `docs/stories/story-release-promocao-integral-staging-producao-20261022.md`.

## Situação

Auditoria **somente leitura** de produção, autorizada pelo agente principal após o usuário pedir a promoção integral do staging. A aprovação genérica do deploy não autoriza alteração estrutural em produção: conforme `AGENTS.md`, seção “Database Safety and Backup Policy”, o único DDL abaixo ainda exige consentimento específico após apresentação do ambiente, comandos, impactos, backup e rollback. Nenhum DDL, migration, backfill, CRUD ou alteração de ambiente foi executado por esta revisão.

## Alvo conferido e inventário remoto

Credenciais lidas diretamente de `.env.local` do checkout principal, exclusivamente para esta auditoria de produção. `.env.staging.local` não foi usado para produção. Nenhum ambiente foi copiado ou alterado. Endpoint conferido: `libsql://banco-alpha-alphacomex.aws-us-east-1.turso.io`; hash SHA-256 da URL: `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`.

Consulta às 20:19 UTC: **337 tabelas**, **2.175 clientes** e **13 colunas em Cliente**. `Cliente.perfilCadastralJson` está ausente. Índices existentes de Cliente: `Cliente_status_idx`, `Cliente_razaoSocial_idx` e `Cliente_cnpj_key` (este último único). Não há tabela `_prisma_migrations` no banco; não usar `prisma migrate deploy` como mecanismo genérico de aplicação.

A tabela `historico_alteracao_cliente` e seus campos de lote, cliente, campo, valor anterior, valor novo, usuário, nome na época, ação e horário já existem em produção. Seus índices também estão presentes. Não é preciso criar outra estrutura para o histórico da edição empresarial.

## Comparação de código e mínimo estrutural

Referências auditadas inicialmente: produção `origin/main=28651e7f`; entrega empresarial validada anteriormente `1290e16f`; staging posterior `ab278f13`. O diff Prisma de main para `1290e16f` contém somente a adição `Cliente.perfilCadastralJson Json?` e a migration `20261022140000_cliente_perfil_cadastral`. O diff Prisma de main para `ab278f13` está vazio. O candidato integrado **`cf04f23e5d1d41307c2658149a2cda60c642931d`**, no worktree `promocao-integral-staging-production-20261022`, une essas entregas. A comparação final `28651e7f..cf04f23e` confirmou **somente** a coluna opcional em `Cliente` e o arquivo da migration com o único `ALTER TABLE` acima; nenhuma outra alteração Prisma foi encontrada. Os ajustes posteriores de radar em andamento não alteravam schema na inspeção. As branches WIP de Checklist não foram incluídas no candidato. Se surgir qualquer mudança posterior de schema, repetir esta auditoria antes da execução/publicação. Auditar apenas main..ab278 omitiria o campo necessário ao editor.

Único SQL mínimo previsto para o candidato integrado, **ainda não executado em produção**:

```sql
ALTER TABLE "Cliente" ADD COLUMN "perfilCadastralJson" JSONB;
```

O tipo `JSONB` corresponde ao Prisma `Json` no SQLite/libSQL, às migrations existentes e ao mesmo DDL já validado no staging. Coluna nullable, sem default, sem backfill; dados atuais permanecem `NULL`. Não há cópia de produção para staging, alteração de índices, constraints, relacionamentos ou exclusão de dados. Risco de perda de dados baixo, com possível espera/breve bloqueio de escrita durante a alteração do schema. O cadastro complementar será salvo somente pelas operações normais autorizadas no editor.

## Backup

O backup de produção anteriormente mais recente, de 2026-10-20 às 17:30 UTC, já tinha aproximadamente 50,8 horas nesta revisão e estava vencido. Foi substituído como evidência por **novo backup completo de produção concluído e verificado**, sem qualquer gravação remota:

- Snapshot consistente em transação HTTP explícita de leitura iniciado em **2026-10-22T20:22:19.984Z**, exportação concluída em **2026-10-22T20:24:04.253Z**.
- Dump: `/home/ialpha/projetos/alpha-comex/painel-alpha/database-backups/pre-change/painelalpha_production_pre_change_2026-10-22T20-22-19-984Z.sql`.
- Manifesto: mesmo caminho base, extensão `.manifest.json`.
- Evidência privada: mesmo caminho base, extensão `.verification.private.json`.
- SHA-256: `87d84f8f39b30f91312068501d4722f195cb27a13120a06a835723aed3709b86`.
- **377.051.609 bytes**, **337 tabelas**, **305.062 linhas**, 1.000 objetos de schema e 59 sequências de autoincremento exportadas. Arquivos privados modo 600.
- Restauração real isolada pelo `scripts/verify-turso-backup.mjs`: **PASS**, `integrity_check=ok`, zero violações de foreign key, SHA-256, tamanho, tabelas e linhas confirmados.
- Manifesto corresponde ao hash exato de produção acima. Nenhuma restauração remota foi feita; nenhum dado foi copiado para staging.
- Revalidar antes do DDL. Por cautela, considerar o início do snapshot como referência: válido por no máximo 48 horas até **2026-10-24T20:22:19.984Z**.

Nenhum dump, token ou registro pessoal deve ser versionado. Backups ficam em `database-backups/pre-change/`, com arquivos modo 600. Nenhum backup desta auditoria será restaurado no staging.

## Plano após consentimento específico

1. Concluir candidato integrado e gates. Apresentar ao usuário o único DDL de produção acima, backup válido e plano de reversão; obter consentimento específico antes de executá-lo.
2. Revalidar hash exato de produção, manifesto do mesmo banco, idade até 48 horas, SHA-256, tamanho e restauração local do backup completo. Se qualquer verificação falhar, bloquear e renovar o backup.
3. Reinspecionar `PRAGMA table_info("Cliente")`, índices e contagem. Se a coluna já existir corretamente, não repetir o comando; se a definição divergir, parar. Registrar metadados em recibo privado.
4. Executar somente o `ALTER TABLE` aprovado em transação curta; conferir número de clientes preservado, uma única coluna adicionada, `JSONB` nullable sem default, valores novos inicialmente nulos e índices inalterados; então commit.
5. Reabrir conexão e confirmar o estado persistido. Publicar o código novo somente depois da coluna existir; do contrário as seleções Prisma podem falhar no schema antigo.
6. DevOps promove o candidato validado, preservando as configurações de produção, e valida o funcionamento sem criar leads, enviar mensagens ou fazer alterações em massa não autorizadas.

Não executar `prisma db push`, reset, seeds, migrations pendentes genéricas ou mudança de configuração. O script genérico `apply-turso-migration.mjs` não contém as proteções específicas deste plano e não deve ser usado sem revalidação e escopo explícitos.

## Alternativa e rollback

Alternativa sem DDL: manter a versão atual de produção e adiar a promoção integral do editor, ou publicar um candidato separadamente revisado que não dependa da nova coluna. A promoção integral solicitada requer a coluna; não salvar os dados complementares em campos com outra finalidade.

Rollback preferencial: voltar ao código anterior e **manter a coluna e os dados**. Não executar `DROP COLUMN`. Uma falha antes do commit permite rollback da transação e reinspeção. Restauração integral remota é último recurso, exige nova autorização, backup do estado corrente e janela controlada, pois pode perder gravações feitas após o snapshot. Nesta auditoria, qualquer restauração é somente local isolada para verificar o backup.

## Parecer da auditoria

**Backup: PASS. Planejamento estrutural: um único ALTER aditivo identificado. Execução em produção: bloqueada até consentimento específico do usuário.** Nenhuma alteração estrutural, migration, backfill ou CRUD foi executada durante a auditoria. O diff Prisma do candidato integrado `cf04f23e5d1d41307c2658149a2cda60c642931d` contra main `28651e7f` foi confirmado: apenas a nova coluna e seu único `ALTER TABLE`. Nenhuma mudança de Checklist foi incluída; alterações futuras de schema exigem nova revisão. O banco fica pronto para a execução do plano assim que houver consentimento específico, revalidação final do backup e preservação deste escopo.
