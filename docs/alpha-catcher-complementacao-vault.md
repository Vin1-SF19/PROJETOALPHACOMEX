# Vault — complementação de cadastros Alpha Catcher

Status: autorizado explicitamente pelo usuário ("Autorizo") e executado em 06/10/2026.

## Ambiente, escopo e diagnóstico
Banco Turso remoto do Consulta Radar, conexão do candidato stage. Conexão
comparada com .env.local usada no backup; identidade coincide, sem expor token.
Dia 06/10/2026 em America/Sao_Paulo: de 06/10 03:00 UTC até 07/10 03:00 UTC.
149 cadastros com fonte iniciada por ALPHA_CATCHER. 74 sem nome fantasia; zero
sem capital social. Dados faltantes também ausentes do JSON ReceitaWS original.
Plano privado em database-backups/pre-change/alpha-catcher-cadastro-2026-10-06T23-00-29.722Z-plano.json.
SHA-256: 545d03ca4e26eb529ae25541af363cf9142c1d098bdb610f2b232456a449da71.

## Operação e impacto
CLI scripts/alpha-catcher-completar-cadastro.mts: plan somente leitura;
apply exige checksum do plano, backup SQL e manifesto verificado. Consulta
ReceitaWS comercial com days=0 e fallback=noCache. Respeita limitador do plano
(até 50/min) e Retry-After; sem chamadas Radar. Preenche apenas nome_fantasia
ou capital_social quando estavam vazios e há valor válido na API. Capital já
preenchido não é alterado. Cada UPDATE é restrito por id, CNPJ, data_consulta
e valores anteriores. Alterações concorrentes causam conflito, sem sobrescrita.
Não altera razão social, data_consulta, outros campos, schema ou snapshots históricos.

Classificação: atualização em lote/backfill, risco reduzido pelo escopo e CAS,
mas exige backup e aprovação específica segundo AGENTS.md e Vault.
74 reconsultas comerciais podem consumir saldo/cota; a ReceitaWS pode continuar
sem nome fantasia. Erros são registrados; esgotamento de cota/token interrompe.
Não há indisponibilidade planejada do painel.
Alternativa sem mutação: manter os cadastros atuais e exibir traço para ausentes.

## Backup verificado
Dump completo: database-backups/pre-change/painelalpha_turso_pre_change_2026-10-05T14-22-43-407Z.sql.
Manifesto: mesmo prefixo .manifest.json. Criado em 05/10/2026 14:27:23 UTC;
idade inferior a 48h nesta preparação; apply bloqueia quando vencer.
190124029 bytes; 332 tabelas; 204120 linhas.
SHA-256: ff99c6b42cc6d4536d735ba544d0d5ce2cb71446bc216accd2a32acd80b6d05e.
Revalidado via scripts/verify-turso-backup.mjs: restauração SQLite temporária,
integrity_check, foreign_key_check, contagem de tabelas/linhas, tamanho e hash.
Evidência: mesmo prefixo .alpha-catcher-verification.json (privado).

## Reversão e validação
Antes de cada gravação, apply persiste registro privado dos valores originais e
novos em database-backups/pre-change/*-rollback.json. Mesmo interrupção entre
UPDATE e confirmação local pode ser revertida pela entrada preparada.
rollback exige checksum do registro e backup válido; restaura somente campos
alterados que ainda correspondam ao valor gravado e à data original. Preserva
alterações posteriores e informa conflitos. Nunca restaura o dump inteiro sobre
o banco ativo como primeira opção; dump completo fica para recuperação assistida.
Após execução: revisar contagens, conflitos, campos ainda vazios e datas preservadas.
Dados reais, plano, dump e rollback não entram no Git.

## Aprovação exigida antes da execução (recebida)
Autorizar explicitamente as 74 reconsultas ReceitaWS e os preenchimentos apenas
de campos vazios conforme este plano. A escolha do escopo "todas as empresas
salvas hoje" não substitui a confirmação após conhecer plano, backup e impacto.

Comando planejado, somente após aprovação:

```bash
node --conditions=react-server --import tsx scripts/alpha-catcher-completar-cadastro.mts apply \
  --plano database-backups/pre-change/alpha-catcher-cadastro-2026-10-06T23-00-29.722Z-plano.json \
  --confirmar 545d03ca4e26eb529ae25541af363cf9142c1d098bdb610f2b232456a449da71 \
  --backup database-backups/pre-change/painelalpha_turso_pre_change_2026-10-05T14-22-43-407Z.sql \
  --manifesto database-backups/pre-change/painelalpha_turso_pre_change_2026-10-05T14-22-43-407Z.manifest.json
```

Validação: lint/typecheck aprovados, quatro testes focais de segurança aprovados na suíte global (4343 aprovados, duas falhas anteriores Builder). Build 10eQw2FRS5NAlH9kMwFhI aprovado.

## Resultado da execução autorizada
Aplicação concluída com exit0: 74 reconsultas ReceitaWS, um nome fantasia
preenchido; 73 retornaram sem fantasia. Zero falhas e zero conflitos.
Verificação posterior read-only confirmou 74 registros presentes, um nome
preenchido, 73 ainda ausentes, zero datas alteradas e zero capitais alterados.
Registro privado de reversão: database-backups/pre-change/alpha-catcher-cadastro-2026-10-06T23-04-32.604Z-rollback.json.
SHA-256: e42ac726e89ffe13952594e00ae12532345211533a7cd317d55d64824d2e7403.
Evidência privada: mesmo prefixo -verificacao.json, verificado em 23:08:22 UTC.
Nenhum dado Radar ou snapshot histórico alterado.
