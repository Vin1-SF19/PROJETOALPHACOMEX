# Vault — configuração de Reunião Agendada no pipeline Revisão de Radar

Data: 2026-09-28. Estado: **prévia validada, publicação bloqueada aguardando autorização explícita específica**.

## Ambiente e banco

Turso remoto de produção `banco-alpha-alphacomex.aws-us-east-1.turso.io`, pipeline `cmuih48la000009gmzw3wwuzf`, etapa `draft-stage-22b5f900-ea72-4374-b48b-8f4fbaff77c5`, versão de configuração 14 na prévia. Não há migration de schema.

## Backup

Backup completo em `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-28T13-13-20-383Z.sql`, com manifesto associado. Criado às 13:18 UTC de 28/09/2026, 170.445.077 bytes, SHA-256 `5d5417b27e3ae403a78104765e3a4939343d373def84c7d4ee99655491ea20c2`, 332 tabelas e 180.760 linhas. `scripts/verify-turso-backup.mjs` restaurou e verificou integridade e FKs (zero violações). A idade deve ser conferida novamente antes da publicação.

## Plano exato de publicação

Executar `scripts/bpm-reuniao-agendada-config.mjs` com `--apply`, `--expected-config-version=14`, `--admin-id=8` (Vinicius, TI) e `--backup-base` do arquivo acima, após aprovação específica. O script exige variável `REUNIAO_AGENDADA_APPROVED=AUTORIZO_REUNIAO_AGENDADA_RADAR`, verifica backup e versão, grava snapshot JSON privado e executa transação única.

- Reutilizar o campo existente **Radar pretendido** e suas três opções.
- Criar **12 campos da Análise de Viabilidade** e **1 campo Resumo da reunião**. Forma de pagamento recebe as três opções fornecidas pelo usuário; Exportador é texto editável. No total, criar 37 opções de seleção e 14 configurações de campo na etapa. Campos da análise ficam opcionais inicialmente, com obrigatoriedade e condições configuráveis na UI; a transcrição permanece obrigatória por regra de domínio para avanço comercial.
- Publicar 1 formulário, 3 seções e 16 componentes: transcrição, Próximo Contato, 13 campos da análise e resumo.
- Desabilitar as 5 saídas para Novo Lead, Agendar Reunião, Fechado, Lost e Monitoramento. Preservar Em tratativas, Stand By e Sem viabilidade.
- Criar 1 cadência associada à etapa com 8 passos de ligação, um por dia útil. O job já implementado só envia para Stand By quando as oito tentativas estiverem registradas, sem Próximo Contato, e após o último dia. A definição pode ser editada/desativada/excluída na UI.
- Incrementar versão do pipeline e criar entrada de auditoria atribuída a Vinicius (TI).

## Impacto, riscos e alternativa

Cards existentes na etapa passam a ter apenas três saídas. Em tratativas e Sem viabilidade passam a exigir transcrição. A cadência cria tarefas e, ao completar oito ligações registradas em oito dias úteis sem Próximo Contato, move o card para Stand By. Há risco de bloqueio de avanço por dados ausentes, falha de configuração Google e conflito com alterações administrativas feitas entre prévia e aplicação. O script usa transação e CAS da versão 14 para reduzir escrita parcial. A alternativa sem escrita é deixar o código pronto e configurar manualmente no editor depois; até então os campos e o formulário não aparecerão no card de produção.

## Rollback

O script cria snapshot privado da configuração imediatamente antes da transação. Em caso de erro durante a aplicação, a transação reverte integralmente. Após commit, reverter com nova transação baseada no snapshot: desativar os 13 campos criados, remover o formulário e a cadência desta etapa se não houver uso posterior, restaurar as 5 transições e o `capabilitiesJson` anterior, incrementar a versão e auditar a reversão. Se já houver dados novos, preservar os valores e desativar campos em vez de excluir. O dump integral só é último recurso, porque restaurá-lo sobrescreveria escritas posteriores de outros módulos.

## Pendências antes da execução

1. Receber aprovação explícita do usuário para **esta configuração**; aprovações de etapas anteriores não cobrem a operação.
2. Reexecutar prévia read-only e verificar versão 14, três saídas existentes, formulário/cadência ainda ausentes.
3. Revalidar backup e idade abaixo de 48 horas.
4. Após aplicar, conferir campos, componentes, transições, cadência, auditoria e FKs; homologar card autenticado e integração Google.
