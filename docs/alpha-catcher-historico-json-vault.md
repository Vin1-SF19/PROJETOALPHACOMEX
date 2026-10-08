# Vault Report — APROVADO para 26 inserts de histórico

Data da revisão: 2026-10-08. Nenhuma mutação foi executada por Vault.

## Ambiente e escopo

Produção: banco remoto Turso usado pelo Painel Alpha, identificado sem exposição de URL ou credenciais pelo SHA-256 `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`. O mesmo identificador consta no plano e no manifesto de backup; a correspondência com o ambiente foi verificada pelo executor responsável.

Recuperar exclusivamente o histórico de `empresas-28-09-2026-alpha-catcher.json` para `lucca@alpha-comex.com`, com 2.491 empresas já existentes. Criar 26 registros em `Auditoria`: um resumo e 25 blocos de até 100 linhas. Não altera schema, cadastros de empresas ou `consultas_radar`; não consulta novamente fornecedores. O histórico registra um snapshot dos cadastros atuais, não reconstrói o resultado exato de ontem. Início, término e quantidade efetivamente salva originalmente permanecem desconhecidos (`null`). A data 28/09/2026 é a data de consulta do JSON, não o momento da importação.

Plano privado: `database-backups/pre-change/alpha-catcher-historico-json-90c21761-9587-40df-8a10-728ce070bec0.plan.json`.

SHA-256 do plano autorizado a apresentar: `8731f57b491d6029762ddd62f1933cc3b615b4f326faf2a4314d41d5d8710f2f`. Alterações no arquivo exigem nova apresentação e confirmação.

## Análise dos statements

- 🟢 Leituras de usuário, empresas e auditoria: sem mutações.
- 🟢 26 `INSERT` em `Auditoria`, em uma transação: risco baixo de perda de dados; ainda constitui backfill e exige backup e consentimento específico.
- 🟡 Rollback: `DELETE` restrito por ID, usuário, ação e conteúdo exato, exclusivamente dos registros correspondentes ao plano. Exige autorização específica de rollback; nunca é limpeza geral da auditoria.
- Não há DDL nem migration. `prisma migrate diff --script` não se aplica a esta recuperação: nenhum schema foi modificado.

O código em `scripts/alpha-catcher-recuperar-historico-json.mts` e `src/lib/alpha-catcher/recuperar-historico-json.ts` foi revisado. O script exige hash exato do plano, banco correspondente, proprietário correspondente, backup com até 48 horas e verificação por restauração antes da transação. Reexecução sequencial reconhece resumo já existente e verifica conteúdo e completude de todos os 25 blocos; divergência, ausência ou duplicidade bloqueiam a operação. O helper `executarRecuperacaoJson` mantém aplicação e rollback na transação; rollback bloqueia conteúdo alterado, evitando exclusão parcial quando uma validação posterior falha. Executar apenas uma instância, pois não há constraint nova garantindo idempotência entre execuções concorrentes.

A refatoração e o adaptador Prisma foram revisados. O log `/tmp/alpha-catcher-json-recovery-tests.log` registra cinco testes sintéticos aprovados, cobrindo os 26 inserts, reexecução, rollback, falha de persistência, proprietário divergente e snapshot alterado. Esses testes não executam mutações no banco real.

## Backup comprovado

Arquivo: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-08T17-22-26-021Z.sql`.

Manifesto: mesmo prefixo, extensão `.manifest.json`. Timestamp registrado: `2026-10-08T17:26:30.019Z`; tamanho: 202.923.381 bytes; 332 tabelas, 209.667 linhas; SHA-256 `91decbf4bf1ba86eb8776168b2830468e8d83599c6bf9235749993a0d109810d`.

O executor responsável informou verificação concluída com Node 22: restauração SQLite real, `integrity_check`, ausência de violações de foreign key, hash, tamanho e contagens aprovados. Vault confirmou os metadados do manifesto; não repetiu a restauração nesta revisão. Revalidar automaticamente na aplicação, como o script já exige. Não versionar dump ou plano com dados reais. Não apagar backups pre-change.

## Etapas propostas

1. Apresentar este escopo, riscos e rollback ao usuário e receber confirmação explícita.
2. Revalidar plano e backup; executar uma única instância do script com `apply`, `--plano`, `--confirmar` contendo o SHA-256 acima, `--backup` e `--manifesto` acima, usando Node 22 e o executor TypeScript do projeto.
3. Conferir resumo, 25 blocos, total de 2.491 linhas e vínculo com a conta indicada; validar exibição no histórico com a implementação correspondente.

Não há downtime planejado. Pode ocorrer bloqueio breve de escrita durante a transação de auditoria. Falha durante a transação deve abortar o lote. O principal risco funcional é representar os valores atuais como se fossem o resultado histórico original; por isso o registro deve indicar recuperação e preservar campos desconhecidos. A lista não dispara consultas ou gravações nos cadastros.

## Rollback e alternativa

Preferir reversão cirúrgica por `rollback` do mesmo script/plano: remove somente registros de conteúdo exato e aborta se encontra duplicatas. Apresentar e autorizar esse DELETE antes de executá-lo; obter backup válido pré-rollback conforme política. Se o conteúdo dos registros tiver mudado, interromper e revisar manualmente. Uma restauração integral do dump é último recurso, em janela controlada e com aprovação própria: pode perder gravações posteriores ao backup e exige novo backup do estado atual. O dump foi testado por restauração local; não foi executada restauração no Turso remoto.

Alternativa sem mutação: continuar consultando a lista pelo JSON e cadastros existentes, sem adicioná-la ao histórico.

## Autorização e liberação

Em 2026-10-08, aproximadamente 18:20 UTC, o usuário respondeu explicitamente **“Então eu autorizo”** após a apresentação do escopo de 26 registros em Auditoria, 2.491 empresas, conta `lucca@alpha-comex.com`, banco Turso, impactos, backup e rollback. O executor responsável comunicou esse consentimento ao Vault. Esta autorização cobre somente os inserts descritos, no plano de SHA-256 `8731f57b491d6029762ddd62f1933cc3b615b4f326faf2a4314d41d5d8710f2f`; não autoriza alterações de cadastros, schema ou execução de rollback.

Imediatamente antes da liberação, o executor responsável revalidou o backup por restauração SQLite real: PASS, 332 tabelas, 209.667 linhas, 202.923.381 bytes, hash acima confirmado, banco do manifesto correspondente ao ambiente e ao plano, idade aproximada de 0,91 hora. Vault recebeu essa evidência; não executou mutações nem repetiu a restauração nesta revisão.

**APROVADO:** executar uma única instância de `apply` para inserir os 26 registros exatos, mantendo as validações do script e a conferência pós-aplicação. Se plano, banco, conta ou escopo mudar, interromper e obter nova revisão e confirmação específica. A aprovação não é evidência de execução: aplicação e resultado devem ser registrados pelo executor.


## Execução e conferência do escopo aprovado

Aplicação realizada em08/10/2026 após consentimento. Primeira transação abortada com SQLITE_BUSY e verificação read-only mostrou zero registros parciais; repetição idêntica concluiu exit0. Inseridos26registros, resumoAuditoria198, importacaoId90c21761-9587-40df-8a10-728ce070bec0. Conteúdo do resumo e25blocos conferido exatamente contra plano; listagem/detalhe do usuário retornam2491CNPJs únicos; Consulta Radar continua com2491dos2491CNPJs. Nenhuma mudança de estrutura ou cadastros. Ativação do build requer sudo interativo e permanece pendente.
