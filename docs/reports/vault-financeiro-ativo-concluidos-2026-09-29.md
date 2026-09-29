# Vault Report — Etapa Concluído e entrega ao Operacional

**Estado: configuração publicada no Turso em 29/09/2026, mediante autorização específica do usuário. Deploy do código da aplicação pendente.**

## Ambiente e inventário

- Banco afetado: Turso remoto de `.env.local` (`TURSO_DATABASE_URL` com protocolo `libsql://`); credenciais e endereço não são registrados aqui.
- Financeiro ativo `cmuih4i54000209gmmyqrg557`, `configVersion=17`; etapa `contratacao_finalizada` ativa e final, sem formulário, com um card legado. Operacional ativo `cmuih4tnh000409gm5z34jvss`, `configVersion=7`; sua chave técnica está vazia, mas o nome é `Operacional` e a etapa `Boas vindas` está ativa, sem formulário.
- A automação existente `financeiro_concluido_criar_card_operacional` já aponta para esse pipeline e essa etapa, mas o tratamento especial do código reconhecia apenas a chave técnica `operacional`. A automação de conclusão automática ainda não existe. As três arestas Formalização/Pagamento/NF → Concluído ainda não publicam o lifecycle `CONCLUIDO`.
- O card legado em Concluído tem `status=ATIVO`, não possui data de conclusão, assinatura, pagamento ou NF confirmados, e já está vinculado a um card Operacional. Este plano **não altera, move, apaga nem desvincula** esse card ou o processo Operacional existente. Ele deve ser tratado em decisão separada.
- `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` retornou `-- This is an empty migration.`. Não há alteração estrutural de tabela, coluna ou índice.

## Operação proposta

Prévia somente leitura `npx tsx scripts/configurar-concluidos-financeiro-ativo.mts` passou. Após autorização específica, repetir a prévia e a verificação do backup, confirmar Financeiro v17 e Operacional v7 e executar:

```bash
npx tsx scripts/configurar-concluidos-financeiro-ativo.mts \
  --apply --approval=AUTORIZO_CONCLUIDOS_FINANCEIRO_ATIVO \
  --expect-financeiro=17 --expect-operacional=7 --admin-id=1 \
  --backup=database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T15-11-58-551Z.sql \
  --manifest=database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T15-11-58-551Z.manifest.json
```

A transação publica Financeiro v17→v18 e Operacional v7→v8: três campos configuráveis novos (Contato, Observações comerciais relevantes e Data de conclusão derivada do card); formulário de Concluído com 23 componentes e obrigatoriedades de entrada; dois campos de captura na etapa de NF; formulário de Boas-vindas com 20 componentes; três arestas com lifecycle `CONCLUIDO`; automação nova de conclusão quando assinatura, pagamento e NF estão confirmados. O servidor também valida a NF completa e os dados de entrada antes do movimento. A automação de handoff existente é preservada e o código passa a reconhecer o pipeline Operacional pelo ID real.

Classificação Vault: `INSERT` de campos, associações, formulários, componentes, configurações e automação **🟡 mutação de configuração em produção**; `UPDATE` de versões de pipeline, formulário de NF e arestas **🟡 mudança de comportamento imediato**. Não há `DELETE`, backfill nem migração de schema neste comando.

## Impacto, riscos e alternativa

- Após publicação, novos movimentos para Concluído exigirão contrato assinado válido, pagamento confirmado e validado, NF emitida válida e os demais dados obrigatórios configurados. A data/hora será registrada na transição. Formulários já abertos podem exigir recarga.
- A nova automação pode tentar concluir cards quando as três confirmações estiverem presentes; campos faltantes impedem o movimento e produzem pendências. Com dados completos, a entrada em Concluído dispara a automação de handoff já existente, que poderá criar um card Operacional vinculado. O risco principal é uma configuração incorreta bloquear movimentos ou criar um processo incompleto; o código e as pré-condições foram ajustados para falhar sem liberar dados insuficientes.
- Alternativa sem mutação: manter Financeiro v17/Operacional v7 e usar apenas o diagnóstico e os testes locais. A etapa seguirá sem formulário e sem conclusão automática válida.
- Rollback seletivo: desativar a automação nova e as três arestas; restaurar versões e configurações de formulários a partir do backup; preservar os valores e cards criados após a publicação, reconciliando manualmente eventuais handoffs. Restauração integral do dump é último recurso, pois sobrescreveria dados posteriores. Qualquer rollback remoto exige novo checkpoint Vault e autorização específica.

## Backup completo verificado

- Dump privado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T15-11-58-551Z.sql`.
- Manifesto privado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T15-11-58-551Z.manifest.json`.
- Motivo `concluidos-financeiro-ativo-v18-v8`, criado em `2026-09-29T15:11:58.551Z`; 141.524.555 bytes; SHA-256 `46488faa460fd815ba2857473ac7c6c0ff209768999056ddd24edb33b22943ce`.
- Dump gerado de snapshot SQLite consistente da réplica Turso sincronizada, cuja integridade e versões Financeiro v17/Operacional v7 foram verificadas. `node scripts/verify-turso-backup.mjs` restaurou o dump em SQLite isolado: `integrity_check=ok`, zero violações de chave estrangeira, 332 tabelas, 193.581 linhas, tamanho e hash conferidos. Expira em 2026-10-01 15:11:58 UTC. Se a versão mudar ou o backup expirar, gerar novo backup e rever o plano.

## Autorização necessária

A autorização anterior para NF v16→v17 não cobria esta operação. Após receber o relatório e a pergunta específica sobre Financeiro v17→v18 e Operacional v7→v8, o usuário respondeu **“publique”** em 29/09/2026. O consentimento não incluiu correção do card legado ou do vínculo Operacional.

## Execução e verificação posterior

- Às 16:00 UTC, a prévia somente leitura repetiu as pré-condições Financeiro v17, Operacional v7, Concluído sem formulário, handoff existente v1 e um card legado. O dump dedicado foi restaurado novamente em SQLite isolado: hash, tamanho, 332 tabelas, 193.581 linhas, integridade e chaves estrangeiras aprovados. O backup tinha menos de uma hora.
- O comando `--apply` documentado acima concluiu com `sucesso=true` e `COMMIT`. Publicou Financeiro v18, Operacional v8, os três campos, formulário Concluído v1 com 23 componentes e 21 obrigatoriedades de entrada, formulário NF v4, formulário Boas vindas v1 com 20 componentes, as três arestas `AMBOS/CONCLUIDO` e a nova automação de conclusão. A automação de handoff existente permaneceu ativa v1 e apontando ao pipeline e etapa Operacional reais.
- `scripts/verificar-concluidos-financeiro-ativo.mts` fez leitura independente e confirmou esses registros. A primeira versão do verificador pressupunha 20 configurações totais em Boas vindas; havia uma configuração anterior adicional, totalizando 21. A verificação foi corrigida para exigir que os 20 componentes publicados possuam configurações visíveis, e passou. Nenhum ajuste remoto adicional foi necessário.
- O card legado incompleto permanece sem alteração. O código da aplicação está no commit local `8973f8e6`, ainda não enviado nem implantado em produção; até seu deploy, a regra de NF obrigatória e a correção do reconhecimento do pipeline Operacional no runtime não podem ser consideradas ativas no servidor publicado. Homologação com card real também permanece pendente.
