# Vault — edição de dados da empresa (staging)

Data da revisão: 2026-10-22. Story: `docs/stories/story-crm-edicao-dados-empresa-historico-20261022.md`.

## Escopo e situação

A preparação inicial foi somente leitura. Posteriormente, o usuário respondeu **“SIM”** à pergunta explícita que autorizava adicionar `Cliente.perfilCadastralJson` exclusivamente no banco de staging e publicar exclusivamente no staging; o consentimento foi comunicado pelo agente principal ao Vault às 16:28 UTC de 2026-10-22. O único `ALTER TABLE` aprovado foi aplicado e verificado às 16:29–16:30 UTC, conforme evidência ao final. Nenhum backfill, CRUD de cadastros, push, alteração de produção ou publicação foi executado pelo Vault. A autorização foi tratada conforme `AGENTS.md`, seção “Database Safety and Backup Policy”.

Banco conferido em `.env.staging.local` do checkout principal, sem carregar `.env.local`: `painel-alpha-staging-alphacomex`, Turso/libSQL, endpoint `libsql://painel-alpha-staging-alphacomex.aws-us-east-1.turso.io`. Identificador SHA-256 da URL: `7fdd160737ba6f9cf84d0ac2fb1c3cf1084311e7fccea454f7bac368f9e4d42b`. Nenhuma leitura, cópia ou alteração de produção faz parte desta operação.

## Inventário e mudança proposta

Consulta remota somente leitura às 13:25 UTC: 337 tabelas; 2.177 registros em `Cliente`; 13 colunas em `Cliente`; `perfilCadastralJson` ainda ausente. Os campos relacionais atuais e o histórico existente permanecem preservados. A tabela `historico_alteracao_cliente` já possui campo, valor anterior, valor novo, usuário, nome na época, lote e horário; não exige outra estrutura para a auditoria solicitada.

A nova coluna guarda os dados complementares editáveis que ainda não cabem no cadastro atual. Modelo Prisma proposto: `perfilCadastralJson Json?`. O provider é SQLite. As migrations existentes e as tabelas reais do staging utilizam `JSONB` para Prisma `Json` — exemplo: `prisma/migrations/20260828171445_add_gerador_documentos/migration.sql`.

Único comando estrutural proposto e posteriormente executado no staging após consentimento:

```sql
ALTER TABLE "Cliente" ADD COLUMN "perfilCadastralJson" JSONB;
```

Coluna opcional, sem valor padrão, sem reconstrução da tabela, sem índices, sem remoção, sem alteração de relacionamentos e sem backfill. Os registros existentes continuam com `NULL`; a aplicação grava os dados complementares apenas durante um salvamento normal autorizado. Risco de perda de dados baixo; a alteração exige um breve bloqueio de escrita de schema e pode falhar/aguardar se houver concorrência. Não se promete indisponibilidade zero.

## Backup existente revalidado

Backup completo exclusivamente do staging criado em `2026-10-20T20:48:47.506654Z` e revalidado nesta revisão com restauração real em SQLite local isolado:

- Dump: `/home/ialpha/projetos/alpha-comex/painel-alpha/database-backups/pre-change/painelalpha_staging_pre_change_2026-10-20T20-48-42-794641+00-00.sql`.
- Manifesto: mesmo caminho com extensão `.manifest.json`.
- SHA-256: `f23c7834fa0348c6836843ae8836cf7166a15b1ef01d3d4b9739b863182a1b0c`.
- Tamanho: 308.225.012 bytes; 337 tabelas; 295.171 linhas.
- Restauração local, `integrity_check`, `foreign_key_check`, hash, tamanho e contagens: PASS.
- Correspondência entre o banco do manifesto e o staging: PASS.
- Idade na revisão: aproximadamente 40,6 horas. Vencimento: `2026-10-22T20:48:47.506654Z`.

Comando usado para a verificação (somente arquivos locais):

```sh
node scripts/verify-turso-backup.mjs '<dump.sql>' '<manifest.json>'
```

A tentativa de criar um backup dedicado mais recente por sincronização inicial de réplica local somente leitura falhou antes de criar arquivos, por erro de transporte `Sync(HttpBody UnexpectedEof)`. Nenhum backup novo é alegado como concluído. O backup existente acima está íntegro e dentro do limite nesta revisão. Não usar um backup que ultrapasse 48 horas no instante de execução; se necessário, renovar por exportação lógica HTTP somente leitura ou repetir o transporte de réplica após resolver a conexão, e restaurar/verificar antes de qualquer DDL.

## Sequência de execução após consentimento

1. Concluir código, testes e revisão antes de solicitar aprovação. Apresentar ao usuário este escopo específico de staging, backup e rollback.
2. Recarregar explicitamente apenas `.env.staging.local`, verificar o hash exato da URL acima e abortar se não corresponder. Os scripts genéricos `turso-backup.mjs` e `apply-turso-migration.mjs` carregam `.env.local` por padrão; não executá-los sem proteção explícita do ambiente. Nenhuma credencial deve aparecer nos comandos/logs.
3. Revalidar backup completo de mesmo banco, idade máxima de 48 horas, hash, tamanho, restauração e integridade. Se vencido ou divergente, gerar e verificar outro backup antes da execução.
4. Reinspecionar `PRAGMA table_info("Cliente")`. Se a coluna já existir com tipo/nullable esperados, não repetir o `ALTER`; se divergir, interromper. Registrar inventário e contagem antes da mudança em recibo privado.
5. Executar somente o `ALTER TABLE` acima, em uma única transação curta. Não rodar `prisma db push`, reset, migrations pendentes genéricas ou seeds.
6. Confirmar a coluna `JSONB` nullable, registros preservados e conteúdo inicial `NULL`. Revalidar o histórico, o fluxo de edição e a consulta de CNPJ no staging; não registrar dados pessoais em evidências públicas.
7. Publicar o código novo no staging após a coluna existir, evitando que seleções Prisma do novo campo atinjam o schema antigo. Guardar recibo privado do comando e verificações. Produção exige pedido futuro próprio.

## Alternativa e rollback

A alternativa sem DDL é manter somente os campos já disponíveis no schema e adiar o armazenamento dos dados complementares; não gravar o perfil estruturado em campos de finalidade diferente. Ela não cobre integralmente o editor solicitado.

Rollback preferencial: voltar ao código anterior, que ignora a coluna adicional. Manter a coluna e seus valores; não executar `DROP COLUMN`. Se a transação falhar antes do commit, realizar rollback da própria transação e reinspecionar. Uma restauração integral remota só seria último recurso e exigiria nova aprovação, backup do estado atual e janela controlada, pois poderia descartar gravações posteriores ao backup. O dump foi restaurado apenas em arquivo local isolado nesta revisão.

## Rotina diária

Não foi encontrada pasta `database-backups/daily` nem rotina diária de backup no crontab deste usuário durante esta revisão. A regra do projeto solicita execução às 02:00 de `America/Sao_Paulo`, retenção de sete dias e limpeza somente após novo backup verificado. Nenhuma rotina foi instalada ou alterada nesta entrega; a ausência não foi tratada como autorização para administrar serviços fora do escopo.

## Execução autorizada e verificada — 2026-10-22

Consentimento: resposta explícita **“SIM”** do usuário à autorização específica de adicionar `Cliente.perfilCadastralJson` no banco de staging e publicar somente no staging. O agente principal transmitiu esse consentimento ao Vault antes da execução. A autorização não foi ampliada para produção, outros comandos estruturais ou operações em massa.

Antes da execução, o dump completo acima foi **novamente restaurado** em SQLite local isolado pelo verificador do projeto: SHA-256, tamanho, 337 tabelas, 295.171 linhas, `integrity_check=ok` e zero violações de chaves estrangeiras. Imediatamente antes do DDL, foram confirmados o hash exato do banco de staging, a correspondência do manifesto, os 308.225.012 bytes, o SHA-256 do arquivo e a idade de **43,6821 horas**, inferior ao limite de 48 horas. Somente `.env.staging.local` foi lido; `.env.local` não foi carregado.

Foi executada uma única transação curta contendo o `ALTER TABLE` documentado acima, com verificações antes do commit e sem outros comandos de alteração. Commit concluído às **2026-10-22T16:29:45.751Z**. Uma **nova conexão independente** confirmou o estado persistido às **2026-10-22T16:30:02.685Z**.

| Verificação | Antes | Após commit |
| --- | --- | --- |
| Registros em `Cliente` | 2.178 | 2.178 |
| Colunas em `Cliente` | 13 | 14 |
| `perfilCadastralJson` | Ausente | `JSONB`, nullable, sem default |
| Valores não nulos na nova coluna | Não aplicável | 0 |
| Índices de `Cliente` | Inventariados | Idênticos |
| Quantidade de tabelas | Inventariada | Idêntica |

A diferença entre os 2.177 clientes do inventário inicial e os 2.178 imediatamente antes do DDL decorre do intervalo entre as verificações; o DDL preservou exatamente os 2.178 registros que existiam no início da sua transação.

Recibo operacional privado, modo 600, sem tokens ou dados pessoais:
`/home/ialpha/projetos/alpha-comex/painel-alpha/database-backups/pre-change/crm-empresa-editor-staging-20261022/ddl-applied.private.json`.

**Resultado Vault: PASS para a etapa estrutural de staging.** O banco está preparado para o deploy do código novo no staging. A publicação permanece com DevOps e não foi executada pelo Vault. O rollback preferencial continua sendo voltar ao código anterior e manter a coluna adicional, sem `DROP` e sem descartar dados.
