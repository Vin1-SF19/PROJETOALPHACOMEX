# Vault Report — Emissão da Nota Fiscal do Financeiro ativo

**Estado: BLOQUEADO para publicação; aguarda autorização explícita específica.**

## Ambiente e operação

- Banco afetado: Turso remoto de `.env.local` (`TURSO_DATABASE_URL` com protocolo `libsql://`), pipeline Financeiro ativo `cmuih4i54000209gmmyqrg557`. O endereço e as credenciais não são registrados neste relatório.
- Leitura em 2026-09-29: `configVersion=16`; formulário da etapa Emissão da Nota Fiscal v2; nenhum card nessa etapa; nenhum dos cinco campos canônicos de NF publicado; quatro automações de pagamento ativas geram tarefa `EMISSAO_NF` com título `Emitir Nota Fiscal – [Razão Social]`. A versão avançou de 12 para 16 por outras publicações no mesmo pipeline durante esta preparação; nenhuma configuração da NF foi publicada.
- Prévia somente leitura: `npx tsx scripts/configurar-emissao-nf-financeiro-ativo.mts` passou novamente. Plano atual: Financeiro v16→v17, formulário da etapa v2→v3, cinco campos configuráveis, quatro obrigatoriedades condicionais e uma regra de valor positivo; versões novas de quatro automações existentes com título `Emitir NF – [Razão Social]`. O tipo/idempotência da tarefa permanece `EMISSAO_NF`.
- `prisma migrate diff` retornou migração vazia: não há alteração estrutural no schema. Esta ainda é uma mutação de configuração de produção com efeito imediato na UI e nos fluxos.

## Comandos e impacto planejados

Após consentimento específico, repetir a prévia, verificar novamente o backup e confirmar que a versão continua 16. Então executar uma única transação:

```bash
npx tsx scripts/configurar-emissao-nf-financeiro-ativo.mts \
  --apply --approval=AUTORIZO_EMISSAO_NF_FINANCEIRO_ATIVO \
  --expect-financeiro=16 --admin-id=1 \
  --backup=database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T14-41-18-822Z.sql \
  --manifest=database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T14-41-18-822Z.manifest.json
```

O script confere versão, formulários e automações antes de escrever, reserva a versão 16 com atualização condicional e aborta se encontrar cards novos na etapa. Depois do commit, uma leitura independente deve conferir os cinco campos em **Configurações → Campos e Formulários**, formulário v3, requisitos, automações v2 e versão 17. Nenhum card é criado, movido ou apagado pelo script.

## Riscos, alternativa e rollback

- Riscos: uma configuração incorreta pode bloquear salvamento/avanço na etapa; as novas validações podem exigir correção de dados quando um card for preenchido. A tarefa de NF já existente poderá ser encerrada automaticamente após registro válido. Formulários abertos no navegador podem precisar de recarga. Não há indisponibilidade planejada, mas transações concorrentes podem causar aborto do commit.
- Alternativa sem alteração no banco: manter a versão 12, executar somente prévia e testes em cópia isolada. A etapa seguirá sem os campos e regras solicitados.
- Rollback: desativar seletivamente os requisitos e campos novos, remover a seção de NF do formulário, restaurar v2 e as versões anteriores das quatro automações a partir do backup. Reconciliar tarefas e eventos eventualmente criados após o commit. Restauração integral do dump só em janela separada, pois sobrescreveria dados posteriores. Qualquer rollback no Turso exige novo checkpoint Vault e nova autorização específica.

## Backup completo verificado

- Dump privado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T14-41-18-822Z.sql`.
- Manifesto privado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T14-41-18-822Z.manifest.json`.
- Motivo: `emissao-nf-financeiro-ativo-v17`; criado em `2026-09-29T14:41:18.822Z`; 141.437.089 bytes; SHA-256 `ebd99d4750ca703cc134555ea8fe2533519d0e833d2d1d9dc9a3963dbc8717fc`.
- A primeira rotina de réplica não concluiu a exportação e a tentativa Prisma sofreu rollback da transação de leitura pelo Turso. O dump final foi criado a partir de uma cópia SQLite consistente da réplica sincronizada com `configVersion=16` e `integrity_check=ok`. `node scripts/verify-turso-backup.mjs` restaurou esse dump em SQLite isolado e validou `integrity_check=ok`, zero violações de chave estrangeira, 332 tabelas e 193.429 linhas; hash e tamanho conferidos. Válido no máximo até 2026-10-01 14:41:18 UTC. Se expirar, falhar ou a versão mudar, gerar novo backup e rever o plano antes de publicar.

## Confirmação necessária

A autorização anterior para confirmação de pagamento v11→v12 não cobre a publicação da NF v16→v17. Antes de executar `--apply`, é necessária uma resposta explícita do usuário que identifique **a publicação da configuração da etapa Emissão da Nota Fiscal no Turso remoto do Financeiro ativo, versão 16→17, conforme este relatório**. Até lá, a prévia e o código permanecem locais.
