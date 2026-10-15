# Vault — Chamados multissetorial — 2026-10-15

Estado: **APPLIED_VERIFIED** — migração e cadastro inicial executados pelo agente principal em 2026-10-15, após consentimento específico **“sim autorizo”** e liberação Vault. Script autorizado terminou com exit code 0: 53 categorias inseridas, 224 chamados preservados, integridade `ok` e zero violações de FK. Validações pós-aplicação concluídas às 17:58 UTC; ver seção final. As seções de preparação preservam o histórico do planejamento anterior à execução.

## Checkpoint anterior à edição do schema

Leitura real somente leitura em 2026-10-15: banco remoto Turso `banco-alpha`, host `banco-alpha-alphacomex.aws-us-east-1.turso.io`, configurado em `.env.local` e tratado como produção por precaução. Identificador verificável pelo SHA-256 da URL `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`. Nenhuma credencial publicada. `prisma/dev.db` não é produção nem backup. Tabela chamados tem 224 registros, 223 concluídos e 1 em atendimento; estrutura atual sem destino ou catálogo de categorias.

Catálogo real: 14 setores ativos, incluindo TI id14. Destinos reais: Admin, CEO, OPERACIONAL, COMERCIAL, Lider Comercial, RECURSOS HUMANOS, FINANCEIRO, JURÍDICO, PARCEIRO, Serviços Gerais, MARKETING, ADMINISTRATIVO e TI. DESVINCULADO é sentinela técnica, excluída. Correspondência de usuários por normalização de role, sem ambiguidade nos destinos; role técnica TV sem setor correspondente não recebe fila. Não criar ou atualizar setor nesta mudança.

## Delta proposto

- 🟢 Criar `chamado_categoria`: PK inteira, FK setorId RESTRICT, nome e nomeNormalizado, descrição opcional, ativo, ordem e timestamps. A tabela nova não remove nem substitui dados existentes.
- 🟡 Criar índice único `(setorId,nomeNormalizado)` na tabela nova inicialmente vazia; sem risco de duplicidade legada, unicidade protege futuras gravações.
- 🟢 Criar índice de consulta `(setorId,ativo,ordem)`.
- 🟢 Acrescentar chamados.setorDestinoId nullable com FK setor RESTRICT. Null compatível com todos os legados.
- 🟢 Acrescentar chamados.setorDestinoNome nullable: snapshot textual do destino.
- 🟢 Acrescentar chamados.categoriaId nullable com FK chamado_categoria RESTRICT. Campo categoria textual continua snapshot histórico.
- 🟢 Criar índices chamados `(setorDestinoId,status)` e `(categoriaId)`.
- 🟡 Provisionar categorias iniciais por setor de modo idempotente, somente INSERT de nomes ausentes. Sem edição, exclusão ou reativação de categorias existentes. TI conserva Hardware, Software, Rede e Acesso. Cada destino recebe Outros do setor. MARKETING e ADMINISTRATIVO recebem sugestões pertinentes, pois apareceram na inspeção real.

Não haverá UPDATE/backfill dos 224 chamados, renomeação, DROP, rebuild de tabela, alteração de responsáveis ou notificações retroativas. Chamados legados com destino null são tratados como TI pela autorização central da aplicação, independentemente do texto da categoria.

## Impacto e alternativas

Operação aditiva com transação única; DDL e índices podem adquirir lock curto e provocar contenção temporária. Falta de espaço, timeout ou falha de FK deve reverter a transação. Não se prevê perda de dados; esta previsão precisa do ensaio e da validação de integridade após execução. A aplicação nova depende das colunas e do catálogo; não publicar/apontar app novo ao banco antigo antes da migração autorizada. SQLite/Turso não oferece RLS Postgres: controle de acesso fica nas actions/rotas canônicas do servidor, com testes negativos por setor.

Alternativa sem mutação: preservar módulo anterior em produção e deixar código novo preparado localmente até aprovação específica. Não simular catálogo persistido via upsert durante leitura.

## Execução e rollback planejados

1. Gerar e restaurar/verificar backup completo dedicado antes da mudança (máximo 48 horas).
2. Conferir inventário, SHA-256 do plano e ambiente com CLI em modo dry-run padrão.
3. Após consentimento humano específico, aplicar apenas SQL aditivo revisado e seed ausente em transação única pelo script preparado.
4. Validar PRAGMA integrity_check/foreign_key_check, contagens históricas, colunas e catálogo; interromper publicação em divergência.
5. Antes da primeira abertura multissetorial: rollback do código pode manter schema aditivo e dados sem usar as colunas novas. Não remover estrutura automaticamente.
6. Depois de qualquer abertura multissetorial: manter autorização por destino e estruturas, bloquear novas aberturas se necessário e corrigir progressivamente. App antigo desconhece isolamento e não é rollback seguro.
7. Restauração integral do dump é último recurso sob autorização específica e janela de manutenção; substituir banco/endpoint por restaurado e reconciliar gravações posteriores. Restaurar snapshot cegamente pode perder alterações ocorridas após backup.

## Backup

**Backup completo verificado antes da aplicação.** O gate passou por AUTHORIZED_PENDING_APPLY após o consentimento específico e foi seguido pela execução registrada ao final. O backup e a autorização cobrem exclusivamente o plano SHA-256 `a8eafbae35adda98a4b276b677f3bd1398335f76a0430051d98a1c9c1cdb220f`. O agente Vault somente liberou o plano; a migração foi executada pelo agente principal. Nenhum backfill foi realizado.

- Dump: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-15T17-32-29-956Z.sql`.
- Manifesto: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-15T17-32-29-956Z.manifest.json`.
- Timestamp verificável do manifesto: `2026-10-15T17:37:26.183Z` (UTC). Revalidar idade máxima de 48 horas no momento de qualquer aplicação.
- Motivo: `chamados-multissetorial-2026-10-15`; origem Turso real confirmada pelo databaseHash `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`.
- Tamanho: 346,696,791 bytes; 336 tabelas; 270,656 registros.
- SHA-256: `843eda3280017886f40d5e12f05ffcf41e356a562cc063a1824e10f91b65f084`.
- Verificação executada: `node --max-old-space-size=8192 scripts/verify-turso-backup.mjs database-backups/pre-change/painelalpha_turso_pre_change_2026-10-15T17-32-29-956Z.sql database-backups/pre-change/painelalpha_turso_pre_change_2026-10-15T17-32-29-956Z.manifest.json` — exit code 0 e `verified: true`.
- Evidência: restauração integral em SQLite temporário descartado após validação; SHA-256 e tamanho iguais ao manifesto, `PRAGMA integrity_check = ok`, `PRAGMA foreign_key_check` sem violações, tabelas e contagem total iguais ao manifesto.
- Contagens pertinentes no dump: 224 chamados, 179 mensagens de chamados, 43 feedbacks, 3 protocolos, 14 setores e 34 usuários. Apenas contagens publicadas; nenhum dado pessoal extraído para este relatório.

Dumps e manifestos ficam em `database-backups/pre-change/`, ignorados pelo Git; nenhum dado real deve entrar nos artefatos versionáveis. O arquivo não participa da limpeza automática dos backups diários. O backup dedicado concluiu normalmente; a demora de aproximadamente sete minutos correspondia à replicação/exportação sem logs intermediários. Não foi necessário cancelar processos nem mudar transporte de backup.

## Artefatos e validação local executada

- `prisma/schema.prisma`: contrato aditivo validado por `node node_modules/prisma/build/index.js validate` (PASS); cliente Prisma 6.19.3 gerado localmente. Não são mutações do banco.
- `prisma/migrations/20261015190000_chamados_multissetorial/migration.sql`: SQL manual aditivo revisado, aguardando aplicação. SHA-256 `f210d5df2b26fc1c489486b2a3c12cc513913e406ab2946cd5c47743c4e2bf22`.
- `prisma migrate diff --from-schema-datamodel /tmp/chamados-schema-before.prisma --to-schema-datamodel prisma/schema.prisma --script`: executado apenas para gerar proposta, sem tocar banco. A proposta automática faria rebuild/DROP de chamados, desnecessário para novas colunas nullable; foi descartada em favor de ADD COLUMN com REFERENCES inline. Não executar o arquivo temporário `/tmp/chamados-prisma-generated-diff.sql`.
- `src/lib/chamados/categorias-iniciais.ts`: catálogo de sugestões somente para provisionamento; nomeNormalizado usa normalizeRole. Não é o catálogo runtime nem realiza upserts.
- `scripts/chamados-multissetorial.mjs`: dry-run padrão, leitura real executada com sucesso. 13 destinos, 53 categorias propostas, 224 chamados preservados. O modo apply exige ambiente exato, hash do plano, manifesto dedicado <=48h e verificação completa restaurando backup temporário; ainda exige consentimento humano registrado. Checa FKs/integridade/contagens dentro da transação e reverte em erro. Não atualiza legados/categorias existentes e não cadastra novos setores.

Plano identificado pelo SHA-256 `a8eafbae35adda98a4b276b677f3bd1398335f76a0430051d98a1c9c1cdb220f` (inclui banco, SQL e conteúdo das 53 sugestões, não inclui credenciais). Mudança do inventário exige repetir dry-run e aprovação.

Comando seguro de revisão (já executado; somente leitura):

```bash
node --import tsx scripts/chamados-multissetorial.mjs
```

Comando autorizado, com manifesto verificado e revalidação automática imediatamente antes da alteração:

```bash
node --import tsx scripts/chamados-multissetorial.mjs --apply \
  --database-hash=3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662 \
  --approve-plan=a8eafbae35adda98a4b276b677f3bd1398335f76a0430051d98a1c9c1cdb220f \
  --backup-manifest=database-backups/pre-change/painelalpha_turso_pre_change_2026-10-15T17-32-29-956Z.manifest.json
```

Não executar Prisma migrate dev/reset/db push ou migrations globais neste banco. O script é específico do delta e não reexecuta o histórico global de migrations; o registro `_prisma_migrations` não é manipulado pelo script. Publicação não foi autorizada nesta missão.

## Liberação Vault após consentimento

Gate de 2026-10-15 às 17:55 UTC: **APROVADO**. A confirmação “sim autorizo” responde ao pedido específico de aplicação no `banco-alpha`, após explicação de uma tabela, três colunas nullable, quatro índices e 53 categorias em 13 setores, sem backfill dos 224 chamados. Não há mudança de escopo após o consentimento.

Revisão somente leitura executada neste gate: `node --import tsx scripts/chamados-multissetorial.mjs` terminou com exit code 0, fase `estrutura-pendente`, mesmo databaseHash, migrationSha256 e planHash registrados, 13 destinos, 53 categorias e 224 chamados. SHA-256 e tamanho do dump conferidos novamente com o manifesto: valores idênticos; idade aproximada de 18 minutos, inferior ao limite de 48 horas. A evidência de restauração integral e integridade descrita acima permanece válida; o modo apply executa novamente o verificador completo antes de iniciar o DDL.

Classificação: alterações aditivas e índices de consulta 🟢; unicidade sobre tabela nova e seed restrito/idempotente 🟡, sem duplicidades legadas ou atualização de dados existentes. O diff Prisma foi analisado e seu rebuild destrutivo descartado em favor do SQL aditivo revisado. Echo/agente principal pode aplicar **somente** o comando e plano identificados neste relatório. Mudança de hash, inventário, ambiente ou falha de backup bloqueia a execução. Depois de aplicar, registrar resultado e validação; publicação continua fora desta autorização.

## Resultado da execução autorizada — 2026-10-15, 17:58 UTC

- Consentimento específico recebido: **“sim autorizo”**, em resposta ao pedido de migração e cadastro no `banco-alpha`; gate Vault aprovado antes da execução.
- Executado exatamente o comando `--apply` deste relatório, com os mesmos hashes e manifesto. O script restaurou e verificou novamente o backup completo antes do DDL e concluiu com exit code 0. Log local: `/tmp/chamados-multissetorial-apply.log`.
- Transação confirmada: nova tabela, três colunas opcionais e quatro índices. **53 categorias cadastradas nos 13 destinos**; nenhum setor criado/alterado. `PRAGMA integrity_check = ok`; `PRAGMA foreign_key_check` sem violações.
- Dry-run posterior identifica `estrutura-existente`, com o mesmo hash do plano; quatro índices conferidos em `sqlite_master` e 53 categorias distribuídas nos 13 setores. Evidências: `.cache/chamados-multissetorial/database-after.json` e `database-apply.json`.
- Preservação do conteúdo comprovada por comparação SHA-256 de todos os campos anteriores: **224 chamados, 179 mensagens, 43 feedbacks e 3 templates de protocolo**, com contagens e hashes idênticos antes/depois. Nenhum dado pessoal incluído nas evidências. Arquivos: `.cache/chamados-multissetorial/preservacao-before.json` e `preservacao-after.json`. As três colunas novas permanecem nulas nos 224 chamados, sem backfill.
- Smoke somente leitura com módulos reais Prisma/catálogo/autorização aprovado: 13 destinos, 53 categorias, 27 responsáveis elegíveis e 29 atores ativos conferidos. Para cada ator, a consulta autorizada retornou exatamente o conjunto calculado pelo predicado de visibilidade; gestão de categorias exclusiva TI e datas do catálogo válidas. Evidência: `.cache/chamados-multissetorial/runtime-readonly.json`.
- Uma verificação adicional somente leitura dos índices teve timeout de conexão; a repetição da leitura passou. A mutação foi executada uma única vez e não foi repetida.

Estado final do banco: **APPLIED_VERIFIED**. Backup pré-alteração preservado e fora do Git. Não foram criados chamados de teste, enviadas notificações ou alterados responsáveis/histórico. A homologação autenticada de ponta a ponta, entrega realtime e publicação do código permanecem fora das validações executadas; não houve commit, push ou deploy.
