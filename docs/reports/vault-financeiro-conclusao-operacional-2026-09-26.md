# Vault Report — BLOQUEADO

**Checkpoint:** conclusão automática do Financeiro e entrega ao Operacional, 2026-09-26 12:16 UTC.

## Ambiente e banco

- `.env.local` aponta `TURSO_DATABASE_URL` para o Turso remoto `banco-alpha-alphacomex.aws-us-east-1.turso.io`. Classificação: **produção**, pelo critério de host remoto. `prisma/dev.db` não é esta fonte.
- Plano somente leitura executado: `npx tsx scripts/financeiro-conclusao-operacional-config.mts` (sem `--apply`). Resultado: `mode: PLAN`; Financeiro `configVersion=49`, Operacional `configVersion=197`. As etapas, campos e formulários esperados existem. As duas arestas para Concluídos existem, ambas com `permitida=false`; a automação nova ainda não existe.
- `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` retornou `-- This is an empty migration.`. Esta publicação não altera schema.

## Operação proposta e classificação

Publicar `scripts/financeiro-conclusao-operacional-config.mts --apply` após aprovação específica. O script executa uma transação com CAS nas versões dos dois pipelines e:

1. 🟡 Atualiza duas `BpmTransicaoEtapa` existentes (Formalização → Concluídos e Pagamento → Concluídos) para `permitida=true`, `origem=AUTOMACAO`, `lifecycleDestino=CONCLUIDO`.
2. 🟡 Cria uma `BpmAutomacao` ativa e uma `BpmAutomacaoVersao` ativa, disparada por atualização de card quando assinatura = Assinado e pagamento = Sim, para mover o card a Concluídos.
3. 🟡 Insere ou atualiza vínculos e configurações de campos para os formulários Concluídos e Boas-vindas, incluindo seis campos obrigatórios na entrada operacional; insere componentes de formulário quando ausentes e incrementa versões dos dois formulários.
   Os campos transportados ficam somente para leitura no formulário operacional; contrato, NF e histórico são consultados pela projeção vinculada atualizada a partir da origem.
4. 🟡 Incrementa `configVersion` de ambos os pipelines. Não há `DROP`, `DELETE`, backfill de cards nem migration.

O comando de publicação previsto, **ainda não autorizado nem executado**, é:

```bash
FINANCEIRO_CONCLUSAO_APROVADO=SIM_PUBLICAR_CONCLUSAO_OPERACIONAL \
  npx tsx scripts/financeiro-conclusao-operacional-config.mts \
  --apply --expected-financeiro-version=49 --expected-operacional-version=197 \
  --admin-id=<ID_DE_ADMIN_ATIVO> \
  --backup-manifest=database-backups/pre-change/painelalpha_turso_pre_change_financeiro_conclusao_2026-09-26T12-15-35-772Z.manifest.json
```

Antes da execução, repetir o plano somente leitura e ajustar as versões esperadas se houver mudança concorrente; qualquer mudança de escopo exige novo checkpoint. O script valida admin ativo, backup dedicado, hash, idade máxima de 48 horas e versões esperadas antes de escrever. A aplicação é atômica no banco, mas a ativação das automações muda imediatamente o comportamento dos cards elegíveis.

## Impacto e riscos

- Cards que já possuam assinatura e pagamento confirmados podem ser movimentados após atualização; a automação pode criar card Operacional por regra existente. Rever a população elegível antes de publicar, para evitar surpresa operacional.
- Se a nova automação ou campos obrigatórios forem configurados incorretamente, cards podem ficar impedidos de avançar ou gerar entregas incompletas. A validação de dados e a idempotência no runtime devem ser testadas antes da publicação.
- A transação evita publicação parcial dos registros de configuração. Mudanças concorrentes são recusadas pelo CAS. Um rollback de configuração não apaga automaticamente cards operacionais já criados ou eventos externos.
- Não há indisponibilidade planejada; consultas e operações normais podem sofrer concorrência durante o commit. Dados do backup são sensíveis e permanecem fora do Git.

## Backup completo e verificação

- Arquivo: `database-backups/pre-change/painelalpha_turso_pre_change_financeiro_conclusao_2026-09-26T12-15-35-772Z.db`
- Manifesto: `database-backups/pre-change/painelalpha_turso_pre_change_financeiro_conclusao_2026-09-26T12-15-35-772Z.manifest.json`
- Criado em: **2026-09-26 12:16:15 UTC**; validade máxima até **2026-09-28 12:16:15 UTC**.
- Origem/método: réplica libsql sincronizada com o Turso remoto; `VACUUM INTO` para SQLite isolado.
- Tamanho: **178.524.160 bytes**; SHA-256: `82225971623e165d55557480d17b62d185fcb5bc28daa524c29a91e72eb25b03`.
- Cópia aberta e checada localmente: **331 tabelas**, **179.118 linhas**, `PRAGMA integrity_check=ok`, `PRAGMA foreign_key_check` com **0 violações**. O manifesto contém esses resultados; não contém token.

## Alternativa não destrutiva e rollback

Alternativa: manter o script em modo plano, sem `--apply`, e validar o runtime em cópia local do backup. A automação e as arestas atuais continuam inativas no banco remoto.

Após eventual publicação, a primeira resposta a defeito é desativar a automação nova e retornar as duas arestas ao estado anterior (`permitida=false`, `origem=AMBOS`) em transação auditada, preservando cards e histórico. Restaurar os vínculos, configurações e versões dos formulários a partir do snapshot pré-publicação ou do backup completo verificado. A restauração integral do Turso é último recurso, em janela própria, pois sobrescreveria gravações posteriores ao snapshot; ensaiar primeiro em instância isolada. Cards já criados no Operacional exigem reconciliação individual, não exclusão automática.

## Decisão Vault

**BLOQUEADO para publicação.** O backup e o plano estão prontos, mas falta a confirmação explícita e específica do usuário para esta operação no Turso remoto. O pedido genérico para implementar mudanças não supre a autorização exigida pelo `AGENTS.md`. Nenhum `--apply` foi executado.
