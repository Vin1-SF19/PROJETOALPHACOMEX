# Vault — correção do nome nos contratos da Giselle

Status: CONCLUÍDO. Backup completo verificado e confirmação específica recebida do usuário: “Autorizo”, em resposta ao plano dos 37 contratos. Correção aplicada e validada.

## Escopo confirmado por consulta de leitura

- Ambiente: produção, Turso `banco-alpha-alphacomex.aws-us-east-1.turso.io`.
- Cadastro: usuário 22, `GISELLE GLEYCE SOUZA SANTOS`.
- Encontrados 37 contratos desse usuário com `closerNome = 'Giselle'`.
- Objetivo autorizado para preparação: corrigir o nome nesses lançamentos.

## Plano de execução

1. Gerar backup remoto completo com `node scripts/turso-backup.mjs correcao-nome-giselle-37-contratos`.
2. Restaurar o dump em SQLite temporário; validar hash, tamanho, integridade, chaves estrangeiras e contagens contra o manifesto.
3. Registrar no diretório de backup os IDs e nomes anteriores dos 37 contratos para rollback restrito.
4. Obter confirmação humana específica deste plano.
5. Em transação, conferir os IDs, o vínculo `usuarioId = 22`, o nome anterior e o nome completo no cadastro. Atualizar exclusivamente `closerNome` nesses IDs para `GISELLE GLEYCE SOUZA SANTOS`. Abortar se o conjunto ou os valores divergirem.
6. Validar que os 37 nomes foram corrigidos e que os demais campos permanecem iguais.

## Risco, alternativa e rollback

Risco baixo: correção de texto em registros existentes, sem exclusão ou mudança estrutural e sem indisponibilidade planejada. O risco principal é selecionar contratos errados; mitigação por IDs explícitos, usuário e guarda do valor anterior. A transação impede aplicação parcial.

Alternativa sem mutação: exibir na interface o nome completo a partir do cadastro; isso deixaria o nome abreviado nos dados históricos.

Rollback preferencial: restaurar `closerNome = 'Giselle'` apenas nos IDs registrados, com guarda do nome corrigido e do vínculo ao usuário. O backup completo serve como recuperação adicional; sua restauração em produção exige avaliação e autorização próprias, para evitar sobrescrever mudanças posteriores.

## Evidência do backup

- Dump: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-05T14-22-43-407Z.sql`.
- Manifesto e validação: mesmo prefixo, extensões `.manifest.json` e `.verification.json`.
- Geração finalizada: 2026-10-05 14:27:23 UTC, dentro da janela de 48 horas.
- Tamanho: 190.124.029 bytes; 332 tabelas e 204.120 registros.
- SHA-256: `ff99c6b42cc6d4536d735ba544d0d5ce2cb71446bc216accd2a32acd80b6d05e`.
- Verificação por restauração real usando Python/SQLite: hash e tamanho conferidos, `integrity_check = ok`, zero violações de chaves estrangeiras e contagens iguais ao manifesto.
- Rollback específico: `database-backups/pre-change/giselle-nomes-rollback-2026-10-05.json`, com os 37 IDs e os nomes anteriores. IDs confirmados também na restauração.
- Dumps e dados de rollback estão em diretório ignorado pelo Git.

## Confirmação recebida

O usuário autorizou a atualização exclusiva de `closerNome` de `Giselle` para `GISELLE GLEYCE SOUZA SANTOS` nos 37 IDs registrados, vinculados ao usuário 22, no banco de produção acima.

## Política aplicável

## Resultado da execução

- Aplicação em produção concluída em 2026-10-05 14:31:28 UTC.
- 37 contratos atualizados em uma transação com guardas por ID, usuário e nome anterior.
- `closerNome` corrigido para `GISELLE GLEYCE SOUZA SANTOS`.
- Comparação de todas as colunas antes/depois, dentro da transação: somente `closerNome` alterado; inclusive datas e `updatedAt` preservados.
- Nova leitura após commit confirmou a persistência dos 37 registros exatamente como validado na transação.
- Zero contratos do usuário 22 com nome divergente após a correção.
- Evidência operacional: `database-backups/pre-change/giselle-nomes-execucao-2026-10-05.json`, fora do Git.
- Comando operacional executado: `node /tmp/corrigir-nome-giselle-autorizado.cjs`; não houve alteração de código do aplicativo.

AGENTS.md exige relatório Vault, backup completo verificado com no máximo 48 horas e confirmação explícita antes de correção em massa. `.agents/skills/vault/SKILL.md`, protocolo de autorização, passo 5: “Pergunte se o usuário autoriza exatamente a alteração descrita e aguarde confirmação inequívoca.”

Não houve mudança de código ou schema; os gates de implementação e migration diff não se aplicam a esta preparação operacional.
