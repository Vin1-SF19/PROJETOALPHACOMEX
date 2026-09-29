# Vault Report — Confirmação de Pagamento do Financeiro ativo

**Estado: APROVADO e publicado após autorização explícita desta operação.**

## Ambiente e operação

- Banco: Turso remoto configurado em `TURSO_DATABASE_URL` (`libsql://`), pipeline Financeiro ativo `cmuih4i54000209gmmyqrg557`.
- A leitura em 2026-09-29 encontrou `configVersion=11`, formulário de Pagamento v1, zero cards em Pagamento e Nota Fiscal, apenas `Pagamento confirmado` e `Status financeiro` entre os sete campos solicitados, e zero requisitos/automações ativos com prefixo `financeiro.pagamento.ativo.`.
- Prévia somente leitura: `npx tsx scripts/configurar-pagamento-financeiro-ativo.mts` passou. Plano: Financeiro v11→v12, formulários de Formalização, Pagamento e Nota Fiscal v1→v2; sete campos novos, condições, requisitos e automações configuráveis. `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` retornou `-- This is an empty migration.`.
- Classificação Vault: mutação de configuração de produção com efeito imediato nos formulários e automações. O script também remove componentes antigos do formulário de Pagamento por filtro específico; não altera schema nem exclui cards ou pagamentos.

## Comandos e impacto planejados

Após autorização específica, repetir a prévia e a verificação do backup. Se as pré-condições permanecerem iguais, executar:

```bash
npx tsx scripts/configurar-pagamento-financeiro-ativo.mts \
  --apply --approval=AUTORIZO_PAGAMENTO_FINANCEIRO_ATIVO \
  --expect-financeiro=11 --admin-id=1 \
  --backup=database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T13-50-37-870Z.sql \
  --manifest=database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T13-50-37-870Z.manifest.json
```

A transação reserva a versão 11, confere as pré-condições novamente e publica os campos, formulários, requisitos e automações. Após o commit, verificar por leitura a versão 12, a composição da UI **Configurações → Campos e Formulários**, as versões ativas das automações e um smoke autenticado com card de teste controlado.

## Riscos, alternativa e rollback

- Riscos: campos obrigatórios ou condições mal configuradas podem bloquear salvamentos/avanços; automações podem alterar status e criar tarefa de Nota Fiscal ou cobrança para cards elegíveis. Um formulário já aberto pode precisar de recarga. Não há indisponibilidade planejada, mas pode haver concorrência no commit.
- Alternativa sem mutação: manter o Financeiro v11 e continuar a validar a prévia e os testes em cópia isolada. A etapa permanecerá sem os sete campos e as automações requeridas.
- Rollback: desativar requisitos/automações publicados e restaurar seletivamente definições e versões dos formulários a partir do backup pré-publicação verificado; reconciliar manualmente qualquer tarefa/evento criado após o commit. A restauração integral do dump é último recurso em janela separada, pois sobrescreveria dados posteriores. Qualquer rollback no Turso exige novo checkpoint Vault e autorização específica.

## Backup verificado

- Arquivo privado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T13-50-37-870Z.sql`.
- Manifesto privado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T13-50-37-870Z.manifest.json`.
- Motivo: `pagamento-financeiro-ativo-v12`; 178.127.117 bytes; SHA-256 `f0219fa0e909be97878cb1021252689768eadcd2dfc04d2b8bf2b322863c49a6`.
- `node scripts/verify-turso-backup.mjs <dump> <manifest>` restaurou o dump em SQLite isolado e passou: `integrity_check=ok`, zero violações de chave estrangeira, 332 tabelas, 192.387 linhas, hash e tamanho conferidos. A validade expira 48 horas após `generatedAt` no manifesto; regenerar e rever o plano se expirar ou se a versão mudar.

## Confirmação necessária

O usuário autorizou especificamente **a publicação da configuração de confirmação de pagamento no Turso remoto do Financeiro ativo, versão 11→12, conforme este relatório**, respondendo “Sim, autorizo” ao pedido que identificava a operação e este plano. A prévia e a restauração do backup foram repetidas imediatamente antes do `--apply`; a idade do backup era de cerca de 0,05 hora.

## Resultado da publicação

- `scripts/configurar-pagamento-financeiro-ativo.mts --apply` concluiu com `sucesso=true` e transação confirmada. Financeiro v11→v12; zero cards estavam nas etapas Pagamento e Nota Fiscal.
- Leitura independente do Turso: Financeiro v12; formulários de Formalização, Pagamento e Nota Fiscal v2; os sete campos solicitados ativos, visíveis e presentes no formulário de Pagamento; seis requisitos ativos; nove automações com uma versão `ATIVA` cada.
- O grafo ativo contém os quatro estados combinados, tarefa de NF com deduplicação, cobrança condicionada ao êxito e cópia preferencial do valor líquido.
- Smoke autenticado com card real permanece pendente: não havia card nas etapas Pagamento e Nota Fiscal, e esta verificação não criou nem moveu card de produção.
