# Vault Report — APLICADO E VALIDADO ✅

**Data do relatório:** 2026-08-20 (America/Sao_Paulo)  
**Ambiente:** PRODUÇÃO — Turso remoto `basetestes-alphacomex` (`aws-us-east-1.turso.io`)  
**Operação proposta:** criar exclusivamente as tabelas e índices novos do módulo Alpha SEO  
**Artefato exato:** `docs/alpha-seo/alpha-seo-migration-candidate.sql`  
**SHA-256 do SQL:** `acbec05894d0588ea949b4a7a8bd5d0e9fdfa6ed7462c8f201f48792c2810bef`  
**Estado:** autorização específica recebida; lote aplicado em transação única e validado com sucesso em 2026-08-20 16:19 BRT.

## Diagnóstico da tentativa de backup anterior

- O processo anterior encerrou sem dump, script, relatório ou log terminal persistido. O fail-safe removeu os artefatos parciais; portanto, não existe evidência suficiente para afirmar a exceção original exata.
- A recuperação reproduziu dois pontos frágeis no caminho de validação local: o handle SQLite mantido no mesmo processo causava `EBUSY` no cleanup do Windows, e o hash bruto do schema considerava cinco caracteres de whitespace terminal em um índice como divergência.
- Uma comparação inicial de contagens também era sensível à ordem das chaves JSON, embora nenhuma tabela tivesse contagem diferente.
- O caminho corrigido restaura o dump em um processo filho, por lotes de no máximo 150 statements/aproximadamente 2 MiB, canonicaliza somente whitespace e `;` terminais para o hash do schema e compara contagens tabela por tabela. O processo filho encerra antes da remoção do banco descartável, eliminando o lock do Windows.
- Não foi usado `executeMultiple` monolítico para restaurar os 137 MB, e nenhum comando de escrita foi enviado ao Turso durante geração, diagnóstico ou validação do backup.

## Auditoria do SQL candidato

O arquivo foi relido do disco e o hash conferido antes do snapshot remoto.

| Statements | Quantidade | Classificação Vault | Justificativa |
|---|---:|---|---|
| `CREATE TABLE` | 44 | 🟢 baixo risco | Todas as tabelas são novas e o preflight remoto encontrou zero objetos `AlphaSeo%`. |
| `CREATE INDEX` não unique | 76 | 🟢 baixo risco | Índices apenas nas tabelas novas e vazias. |
| `CREATE UNIQUE INDEX` | 34 | 🟢 baixo risco no estado atual | Os alvos são tabelas novas e vazias; não há dados existentes que possam violar unicidade. |
| Índices parciais | 5 | 🟢 baixo risco | Subconjunto dos 110 índices acima, também restrito às tabelas novas. |
| `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`, `PRAGMA` | 0 | — | O lote não altera objetos existentes, não contém DML, backfill ou seed. |

Total: **154 statements**, sendo **44 tabelas + 110 índices**. O dry-run local anterior criou 44/110 objetos e terminou com zero violações de FK. O preflight remoto executado imediatamente antes do backup confirmou **zero objetos Alpha SEO** existentes.

Se o arquivo ou seu SHA-256 mudar, esta autorização deixa de valer e o gate Vault deve ser reiniciado.

## Backup completo verificado

- Dump: `database-backups/pre-change/painelalpha_turso_pre_change_alpha-seo_2026-08-20T19-05-44.748Z.sql`
- Manifest: `database-backups/pre-change/painelalpha_turso_pre_change_alpha-seo_2026-08-20T19-05-44.748Z.manifest.json`
- Criado em: **2026-08-20 16:05:44 BRT** (`2026-08-20T19:05:44.748Z`)
- Validade pelo protocolo de 48 horas: até **2026-08-22 16:05:44 BRT**. Depois disso, um novo backup é obrigatório.
- Tamanho: **137.114.302 bytes**. O tamanho maior que dumps anteriores decorre da codificação determinística de texto em hexadecimal UTF-8, usada para preservar boundaries de statements sem expor conteúdo durante o restore.
- SHA-256 do dump: `2f34e7abc0cda2e25863c110faa2724567803014a5ab2bc4a5b15e4357dd8f03`
- SHA-256 canônico do schema: `85f238c9d5fc05dd2431b2ea58c79006bdf17e063c62733e3310d742a19364af`
- Snapshot: **198 tabelas**, **427 índices totais** (**277 explícitos**), **2 triggers**, **0 views**, **37.954 linhas**.
- Restore descartável: **38.490 statements** reexecutados do arquivo reaberto do disco.
- Validações: SHA do dump relido, nomes e hashes de objetos iguais, contagens por tabela iguais, `sqlite_sequence` igual, `PRAGMA integrity_check = ok`, `PRAGMA quick_check = ok`, `PRAGMA foreign_key_check = 0`.
- Não existem arquivos `.restore-validation.db` ou `.restore-expected.json` remanescentes.

O dump e seu manifest não devem ser versionados nem ter conteúdo exibido em logs.

## Plano de aplicação proposto

1. Revalidar imediatamente antes da aplicação os hashes do SQL e do backup, sua idade e a inexistência de objetos `AlphaSeo%` no Turso.
2. Abrir uma transação de escrita no Turso e executar somente os 154 statements do SQL com SHA-256 acima.
3. Em qualquer erro, fazer rollback da transação e interromper; não tentar completar parcialmente.
4. Após commit, conferir a criação das 44 tabelas e 110 índices, as FKs/índices esperados e executar `PRAGMA foreign_key_check`.
5. Confirmar que as 198 tabelas pré-existentes e suas contagens de referência permanecem inalteradas. Nenhum seed, backfill ou dado Alpha SEO será inserido neste gate.

## Impacto e riscos

- A operação adiciona 44 tabelas vazias e 110 índices; não altera nem remove estruturas ou linhas existentes.
- Há risco baixo de contenção ou aumento temporário de latência enquanto o catálogo é atualizado.
- Uma queda de conexão sem transação íntegra poderia deixar DDL parcial; por isso a aplicação deve abortar no primeiro erro e validar o catálogo antes de qualquer uso do módulo.
- Drift de schema, surgimento de qualquer objeto `AlphaSeo%`, expiração do backup ou mudança do SQL invalida este relatório e exige novo preflight/backup/confirmação.
- O risco operacional posterior vem de gravações reais do módulo. Este gate autoriza somente estrutura vazia, não autoriza seed, backfill, importação ou mutação em massa.

## Alternativa não destrutiva

Manter apenas contratos, inventário, CLI e testes do Alpha SEO, com o módulo desabilitado e sem persistência no Turso. Essa alternativa não toca produção, mas não entrega a paridade funcional solicitada porque projetos, keywords, rankings, auditorias, OAuth e histórico não teriam persistência multiusuário confiável.

## Rollback

- Antes do commit: rollback integral da transação.
- Depois do commit, antes de dados reais: desabilitar o módulo e manter as tabelas vazias é a alternativa mais segura; nenhum `DROP` será executado automaticamente.
- Remover as tabelas ou restaurar o dump completo exigirá novo relatório Vault e nova confirmação explícita. Uma restauração completa deve ocorrer sob write freeze, pois sobrescreveria mudanças legítimas posteriores ao backup.
- O dump verificado acima é a evidência de recuperação, não uma autorização automática para restore.

## Resultado da aplicação

- Autorização específica recebida para o SQL SHA-256 `acbec05894d0588ea949b4a7a8bd5d0e9fdfa6ed7462c8f201f48792c2810bef` no Turso `basetestes-alphacomex`, limitada a `CREATE TABLE` e `CREATE INDEX`, sem `ALTER`, `DROP`, backfill ou seed.
- Preflight imediatamente anterior à escrita: hashes do SQL e backup conferidos; backup dentro da janela de 48 horas; zero objetos `AlphaSeo%`; DDL remoto comparado objeto a objeto com o dump verificado; 198 tabelas e 37.954 linhas de referência iguais ao manifest.
- Aplicação: uma transação de escrita, 154 statements autorizados, sendo 44 `CREATE TABLE` e 110 `CREATE INDEX`. Nenhum DML de aplicação foi executado.
- Validação antes do commit: 44 tabelas, 110 índices, 73 chaves estrangeiras, 5 índices parciais, `PRAGMA foreign_key_check = 0`, DDL anterior preservado e contagens de referência inalteradas.
- Validação após o commit: 44 tabelas, 110 índices, 73 chaves estrangeiras e 5 índices parciais novamente confirmados; zero violações de FK.
- Resultado final: **APLICADO E VALIDADO** em `2026-08-20T16:19:32.613-03:00`.

O backup `database-backups/pre-change/painelalpha_turso_pre_change_alpha-seo_2026-08-20T19-05-44.748Z.sql` permanece preservado. Qualquer remoção, alteração estrutural adicional, seed, backfill ou restauração exige um novo gate Vault e nova autorização explícita.
