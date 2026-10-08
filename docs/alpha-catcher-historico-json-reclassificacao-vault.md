# Vault Report — APROVADO para reclassificação dos 26 registros

Revisão em 2026-10-08. Vault não executou mutações.

## Escopo e ambiente

Produção, Turso remoto do Painel Alpha. Banco identificado pelo hash `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`, sem exposição de credenciais. Alterar somente o conteúdo de 26 registros existentes de `Auditoria` do histórico recuperado `90c21761-9587-40df-8a10-728ce070bec0`, pertencente a `lucca@alpha-comex.com`.

Regra solicitada pelo usuário: data de consulta exatamente em 28/09/2026 às 12:00 em America/Sao_Paulo (`2026-09-28T15:00:00.000Z`) representa “Salvo”; demais representam “Já no banco”. A leitura preparatória confirmou 2.375 registros na primeira categoria e 116 na segunda, total de 2.491. O resumo passa a `novasSalvas=2375` e registra expressamente que a classificação foi definida pelo critério informado pelo usuário. Isso é inferência por data, não prova de criação original na importação. Não altera datas, cadastros ou `consultas_radar`, não faz consultas externas e não muda schema.

Plano privado: `database-backups/pre-change/alpha-catcher-reclassificacao-90c21761-9587-40df-8a10-728ce070bec0-1791484751481.plan.json`.

SHA-256: `3315f557fcb7ae1ca4cf5c454cf71d79af794c943836ffa77d383a9d0177736f`.

## Revisão técnica e classificação

Revisados `src/lib/alpha-catcher/reclassificar-historico-json.ts` e `scripts/alpha-catcher-reclassificar-historico-json.mts`.

- 🟢 Leituras de usuário, Auditoria e datas de consultas: não alteram dados.
- 🟡 26 `UPDATE` de detalhes da Auditoria: backfill com mudança semântica do histórico; exige confirmação e backup completo. Cada atualização restringe ID, proprietário, ação e conteúdo anterior exato. Conteúdo já igual ao destino permite reexecução; divergência aborta a transação.
- 🟡 Rollback: 26 `UPDATE` igualmente restritos, restaurando conteúdo anterior exato a partir do conteúdo novo. Deve ser autorizado separadamente antes de executar.
- Não há DDL ou migration; diff de schema não se aplica.

O preparo verifica datas dos cadastros contra o snapshot, blocos sequenciais, IDs do lote e contagem completa, bloqueando divergências. Uma transação envolve todas as escritas e a verificação de proprietário. Executar apenas uma instância. O executor informou cinco testes sintéticos aprovados em `/tmp/alpha-catcher-reclassificacao-tests.log`; o log de execução foi conferido por Vault. Nenhuma mutação real decorre desses testes.

## Backup

Novo backup completo concluído pelo executor via Prisma em modo somente leitura, depois da inserção do histórico:

- SQL: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-08T18-47-58-926Z.sql`.
- Manifesto: mesmo prefixo, extensão `.manifest.json`.
- Timestamp: `2026-10-08T18:47:59.133Z`; tamanho 200.770.158 bytes; 332 tabelas; 209.792 linhas.
- SHA-256: `0e9960def3331cf34b0fe26d84b0fde8dc7d1bc0f6e64860b69c037a950ea2ac`.
- Banco no manifesto: hash acima, correspondente ao ambiente confiável e ao plano.

Vault conferiu manifesto e log `/tmp/alpha-catcher-reclassificacao-backup-verify.log`: restauração SQLite real aprovada, com integridade, foreign keys, hash, tamanho e contagens verificados pelo executor. A restauração foi realizada com `TMPDIR=database-backups/pre-change`; a tentativa em `/tmp` apresentou erro de I/O no tmpfs e foi substituída por execução concluída com sucesso. Vault não repetiu a restauração. Revalidar backup e idade máxima de 48 horas imediatamente antes de aplicar; usar o diretório temporário que concluiu a verificação. Dumps e planos privados não devem ser versionados ou removidos pela retenção diária.

## Plano, impactos e riscos

Após backup válido e autorização específica, executar `apply` no script de reclassificação com o plano acima, SHA-256 exato em `--confirmar`, SQL completo em `--backup` e manifesto em `--manifesto`, com Node 22 e executor TypeScript do projeto. O script revalida banco, idade máxima de 48 horas e restauração do backup antes da transação.

Conferir depois 26 registros do lote, 2.491 linhas, 2.375 estados “salvo”, 116 estados “existente”, contador do resumo e metadado do critério. Validar a exibição no histórico.

Não há parada planejada; pode haver bloqueio breve de escrita durante a transação. Não se prevê perda de cadastros. O risco principal é interpretação indevida da classificação inferida como prova histórica; preservar o metadado do critério. Divergência de conteúdo deve abortar sem aplicar lote parcial.

## Rollback e alternativa

Preferir `rollback` do mesmo script/plano, com confirmação específica e backup completo válido pré-rollback: restaura exatamente o conteúdo anterior dos 26 registros e bloqueia conteúdo inesperado. A operação não altera cadastros. Não restaurar integralmente o Turso sem outra análise e confirmação: restaurar o dump pode perder gravações posteriores e exige janela controlada e backup do estado atual.

Alternativa sem mutação: manter a recuperação atual com todos os itens marcados como existentes e comparar as datas apenas em um relatório de leitura.

## Autorização e liberação

Em 2026-10-08, o usuário respondeu explicitamente **“autorizo”** após a apresentação final dos 2.375 itens Salvo e 116 existentes, dos 26 registros de Auditoria, do banco Turso compartilhado, backup validado, rollback, riscos e alternativa. O executor responsável comunicou o consentimento ao Vault. O escopo e o SHA-256 do plano permanecem inalterados.

**APROVADO exclusivamente para `apply` deste plano:** `3315f557fcb7ae1ca4cf5c454cf71d79af794c943836ffa77d383a9d0177736f`. Executar uma instância, com `TMPDIR` no diretório pre-change que concluiu a restauração, mantendo verificação automática de hash do plano, identidade do banco, proprietário, idade e restauração do backup, transação e comparação exata de conteúdo. Conferir resultado e contagens depois.

A autorização não cobre alterações em cadastros, schema, outros lotes ou execução de rollback. Se qualquer parte do escopo ou plano mudar, interromper e solicitar nova revisão e confirmação. Vault não executou mutações; esta aprovação não comprova aplicação. O executor deve registrar o resultado da execução.

## Resultado informado pelo executor

Após consentimento específico e aprovação Vault, apply terminou com exit0 e atualizou 26 registros. Verificação read-only posterior conferiu conteúdo exato do plano, nenhum lote duplicado, 2.491 linhas únicas, 2.375 salvo, 116 existente, contador2375 e 2.491 cadastros presentes no Radar. Evidências: /tmp/alpha-catcher-reclassificacao-apply.log e /tmp/alpha-catcher-reclassificacao-verify.log. Sem alterações em consultas_radar.
