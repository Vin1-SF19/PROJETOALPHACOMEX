# Vault Report — CONCLUÍDO: plano autorizado aplicado e conferido

Revisão inicial: 2026-10-20, 17:24 UTC. Backup concluído e verificado nesta sessão após 17:30 UTC. Revisão do plano final: 2026-10-20, aproximadamente 17:53 UTC. Liberação após autorização: 2026-10-20, 18:01:34 UTC. Execução concluída às 18:02:56 UTC; reconciliação final às 18:04:52 UTC.

Skill aplicada: [Vault](../../.agents/skills/vault/SKILL.md). O `AGENTS.md` exige plano concreto, backup completo verificado com até 48 horas e confirmação específica antes de executar importação/backfill em massa.

## Pedido e limites

O novo pedido é comparar os cards do Alpha com o RD Station e atualizar **somente histórico e autoria original dos registros**, conforme confirmado pelo usuário. A comparação e a prévia estão concluídas. Após a apresentação explícita do lote de **447 alterações em 237 cards**, o usuário respondeu **“Sim vida autorizo”**, autorizando a aplicação em produção do fingerprint abaixo. Essa autorização específica foi comunicada a Vault pelo agente responsável pela conversa.

A autorização anterior do alinhamento do CRM, fingerprint `22095fae6cc62886d0dae11557f41a1bdf690c5b9a0e886c5c1f2882ef31dca1`, já foi consumada no escopo de configuração daquela entrega e **não autoriza esta importação de histórico/autoria**.

Não alterar negócios no RD, responsáveis atuais dos cards, etapas, campos comerciais, contatos, pagamentos, anexos ou permissões. A autoria histórica deverá corresponder à evidência da origem; não pode ser presumida a partir do responsável atual ou da conta que executa a carga.

## Ambiente

- Banco remoto, tratado como **produção**, configurado por `TURSO_DATABASE_URL` de `.env.local`.
- SHA-256 seguro da URL, conferido por leitura em 2026-10-20 17:24:26 UTC: `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`.
- O identificador corresponde ao banco de produção verificado na entrega anterior.
- Não foram expostos URL, tokens ou dados dos registros.
- Nenhuma carga, alteração de schema, escrita no RD ou atualização remota foi executada por Vault.

## Backup novo

O dump mais recente encontrado era de **2026-10-19**, anterior à configuração aplicada em 20/10 e a outras gravações do aplicativo. Para esta carga, iniciou-se um **novo backup completo**, por réplica local sincronizada e exportação somente leitura:

```bash
TMPDIR="$PWD/database-backups/pre-change/vault-verificacao" node scripts/turso-backup.mjs rd-historico-autoria-preflight-2026-10-20
```

O diretório temporário usa o disco do projeto; `/tmp` apresentou erro de I/O em verificação anterior e não será utilizado. O destino é `database-backups/pre-change/`, ignorado pelo Git e fora da retenção automática de backups diários.

**Backup completo novo gerado e verificado com sucesso.**

- Dump: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-20T17-26-08-703Z.sql`.
- Manifesto: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-20T17-26-08-703Z.manifest.json`.
- Data de conclusão no manifesto: **2026-10-20 17:30:04.713 UTC**.
- Motivo: `rd-historico-autoria-preflight-2026-10-20`.
- Identificador do banco: `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`, igual ao ambiente confirmado.
- Tamanho: **366.320.989 bytes**.
- Conteúdo restaurado: **337 tabelas e 293.950 linhas**.
- SHA-256: `2aa3ae96a30e4a08f17ee27fd2cdc05edeb4b0cae9c73b00776b01fc057ad2bd`.
- Validação: restauração integral local, SHA/tamanho iguais ao manifesto, `PRAGMA integrity_check=ok`, nenhuma violação de FK e contagens coincidentes.
- Validade máxima pelo manifesto: **2026-10-22 17:30:04.713 UTC**. Revalidar imediatamente antes da carga; se houver atraso além dessa janela ou nova necessidade de um checkpoint anterior à carga, gerar/verificar outro backup.

Comando de verificação executado com retorno `verified=true`:

```bash
TMPDIR="$PWD/database-backups/pre-change/vault-verificacao" node scripts/verify-turso-backup.mjs database-backups/pre-change/painelalpha_turso_pre_change_2026-10-20T17-26-08-703Z.sql database-backups/pre-change/painelalpha_turso_pre_change_2026-10-20T17-26-08-703Z.manifest.json
```

As réplicas/restaurações temporárias foram removidas pelos scripts após conclusão. Nenhum dump foi versionado e nenhuma escrita remota foi feita para gerar ou validar este backup.

## Artefatos e identidade do plano final

- Diretório privado: `database-backups/pre-change/rd-historico-autoria-2026-10-20/`.
- Plano: `plan.json`.
- Fingerprint recalculado e válido: **`4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece`**.
- Banco do plano: `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`, igual ao backup e ao ambiente.
- Hash agregado do executor e bibliotecas, recalculado e válido: `ce2f8306bc1893d4e4a2c5a0fbe1707c9505e9142ad78ae182930e1f424b7049`.
- `scripts/reconciliar-historico-autoria-rd.mjs`: SHA-256 `e1794ad2fad0b2543aa444e900cf60bd4b43aabdb772deeb97bf752c22643c69`.
- `scripts/lib/rd-history-reconciliation.mjs`: SHA-256 `2debfcfa1b6ac9dc74d2a8988a6be13ed4a84ea5ff17e7cca3a85b4034de7863`.
- `scripts/lib/rd-complement-recovery.mjs`: SHA-256 `ec4e0419a30f496d91d5af58f1251fe8094813035ee23f8081e816ba6b2cca72`.
- Geração do plano: **2026-10-20 17:51:10.197 UTC**.
- Conclusão da coleta de origem: **2026-10-20 17:46:24.369 UTC**.

O executor exige origem coletada há no máximo 24 horas: aplicar até **2026-10-21 17:46:24.369 UTC**, além da validade do backup. Vencimento da fonte exige nova comparação/prévia e revisão do novo fingerprint; não autoriza reaproveitar silenciosamente a confirmação antiga.

## Resultado da comparação e carga proposta

Foram inventariados **1.234 cards Alpha**, dos quais **1.221 têm vínculo RD** e **13 são nativos/sem vínculo**. O RD possui **1.572 negócios**, dos quais **351 não têm card Alpha vinculado**. Não serão criados cards para esses 351 negócios e os 13 cards sem vínculo ficam preservados.

Nos vínculos existentes foram comparados **3.682 registros de anotação, 7.177 históricos de etapa e 1.624 registros de tarefa**: **12.483 eventos**, sendo **12.036 sem alteração** e **447 mudanças propostas em 237 cards**.

| Família do histórico | Inserções | Atualizações de projeção |
| --- | ---: | ---: |
| Anotações RD | 55 | 23 |
| Tarefas registradas no histórico RD | 28 | 254 |
| Passagens por etapas RD | 39 | 48 |
| **Total** | **122** | **325** |

As tarefas acima são eventos importados de histórico; **não** são tarefas operacionais `BpmTarefa`. As mudanças de etapa acima são registros passados da linha do tempo; **não** movem cards no funil.

Há **77 nomes de autoria recuperados** na projeção histórica. A resolução usa o ID do autor na fonte e os catálogos RD, sem deduzir autoria pelo responsável atual. A coleta não encontrou conflito de nomes entre os catálogos consultados.

Limitações preservadas e apresentadas ao usuário:

- Os **7.177 históricos de etapa** não identificam o autor original na fonte; nenhum autor será inventado.
- **71 registros de etapa** têm nome de etapa indisponível no catálogo e **2 campos de data de tarefas** estão ausentes. Não preencher dados fictícios nem apagar valor existente por essa ausência.
- As alterações de anotações têm conferência de identidade/autoria/data por API V2: **54 negócios e 266 notas** verificados. As 266 notas têm diferença de representação textual/HTML entre as APIs; o HTML V2 não substitui o conteúdo V1.
- Campos corrigidos manualmente são protegidos. O lote atual não encontrou conflitos que exigissem sobrescrever campos manuais.

## Escritas examinadas e classificação

O SQL concreto do plano possui somente estas escritas; os marcadores são acrescentados pelo executor compartilhado:

| Escrita | Quantidade | Classificação e limite |
| --- | ---: | --- |
| `INSERT INTO BpmEventoExternoCard` | 122 | Aditiva. Eventos faltantes por vínculo e identidade externa; grava payload de origem somente nos eventos novos. |
| `UPDATE BpmEventoExternoCard SET projectedJson=?, updatedAt=? WHERE id=?` | 325 | Alteração de dados com risco controlado. Atualiza exclusivamente a projeção histórica e timestamp de modificação de IDs exatos. Não atualiza `rawJson` nem identidade externa. |
| `INSERT INTO BpmEventoExternoCorrecao` | 325 | Aditiva. Preserva projeções anterior/nova, versão e campos alterados; `autorId=null` identifica ajuste automatizado, sem personificar autor original. |
| `INSERT INTO BpmCardHistorico` | 447 | Aditiva. Marcador de aplicação por fingerprint/operação, com origem automática e ID determinístico. |

São **1.219 escritas** previstas para as 447 operações de histórico, incluindo as auditorias. Nenhum `UPDATE/INSERT/DELETE` do plano alcança `BpmCard`, `BpmTarefa`, campos comerciais, contatos, anexos, vínculos externos, permissões ou dados do RD. Não há DDL nem mudança de schema; não existe migration a aprovar.

## Concorrência, idempotência e aplicação parcial

Cada operação possui **três guardas antes e três depois**: vínculo card/origem, estado completo do evento identificado e conjunto de correções do evento. Identidade alternativa legada também é conferida para impedir duplicação por chaves diferentes.

O executor agrupa até **20 operações por transação de escrita**, totalizando **23 lotes**. Dentro de cada transação, consulta marcadores determinísticos, seleciona apenas operações pendentes, confere todos os estados e somente então grava o lote. Divergência bloqueia o lote inteiro, sem sobrescrever a alteração concorrente.

Não há uma transação global das 447 operações. Se um lote falhar, os anteriores podem estar confirmados. O operador deve inspecionar marcadores/estado antes de decidir continuar ou reverter. A repetição do mesmo plano ignora operações já marcadas, não duplica eventos/correções e termina com verificação dos estados posteriores. Um plano que já foi revertido não pode ser reaplicado: exige nova prévia.

Plano, banco e hash do executor são validados antes da execução. O comando também exige fingerprint de confirmação, simulação aprovada correspondente, fonte dentro de 24 horas e backup completo validado do mesmo banco com até 48 horas.

## Evidência de simulação local

Vault examinou `simulation.json` e confirmou seu fingerprint e o backup utilizado. A simulação foi executada pela implementação em restauração isolada do backup novo; esta revisão não repetiu a simulação pesada nem efetuou gravações remotas.

- Primeira aplicação local: **447 aplicadas, zero ignoradas**.
- Estado posterior: **1.341 guardas conferidas, todas coincidentes**.
- Repetição local: **zero aplicadas, 447 ignoradas** — idempotência confirmada.
- Rollback local: **447 revertidas**.
- Estado revertido: **1.341 guardas conferidas**, preservando registros de auditoria.
- `integrity_check=ok`, **zero violações de FK**.
- Backup da simulação: o dump de **20/10 17:30 UTC**, SHA-256 `2aa3ae96a30e4a08f17ee27fd2cdc05edeb4b0cae9c73b00776b01fc057ad2bd`.

A revisão do código e dos testes específicos também confirmou o tratamento de rollback após aplicação parcial: operações nunca aplicadas são ignoradas e suas alterações concorrentes são preservadas, enquanto operações aplicadas só revertem se o estado posterior ainda conferir. Não se exige restaurar o “antes” de uma operação que a carga nunca chegou a aplicar.

## Impactos, alternativa e rollback

O efeito pretendido é completar a linha do tempo e recuperar a autoria histórica comprovada. Os riscos concretos incluem fonte desatualizada entre coleta/aplicação, conflito com correção local e bloqueio de escrita durante algum lote. Fingerprints, identidade externa, guardas e transações reduzem esses riscos; uma falha pode deixar somente os lotes anteriores aplicados, conforme explicado acima.

**Alternativa sem escrita:** concluir a comparação e apresentar somente o relatório de diferenças, mantendo todos os dados atuais.

O rollback é seletivo, em ordem inversa, baseado no mesmo plano e nos marcadores:

- Para até **122 inserções**, executa `DELETE FROM BpmEventoExternoCard WHERE id=?` apenas no evento criado pela carga, depois de conferir seu estado e a ausência de correções posteriores. Essa remoção é **destrutiva restrita** e requer autorização específica de rollback.
- Para até **325 atualizações**, restaura a projeção anterior e acrescenta uma correção compensatória; não apaga a trilha de correções.
- Acrescenta até **447 marcadores de reversão** em `BpmCardHistorico`. Ignora operações nunca aplicadas ou já revertidas.
- Se um evento aplicado tiver recebido alteração posterior, a reversão daquele lote para; não sobrescreve a edição concorrente.
- O rollback preserva auditoria e não pretende restaurar todos os bytes/timestamps do banco. Sua verificação confirma o conteúdo histórico revertido e a trilha compensatória.

Antes de rollback, obter autorização própria e revalidar backup, plano e estado. Não executar rollback automaticamente após falha de um lote. Uma restauração integral do dump pode descartar gravações posteriores e não será feita automaticamente; requer plano e autorização específicos.

## Comandos autorizados e executados pelo responsável

A confirmação específica foi recebida. O agente responsável executou o mesmo script revisado com o mesmo fingerprint, preservando todas as revalidações internas:

```bash
TMPDIR="$PWD/database-backups/pre-change/vault-verificacao" node scripts/reconciliar-historico-autoria-rd.mjs apply --dir=database-backups/pre-change/rd-historico-autoria-2026-10-20 --confirm=apply:4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece --backup=database-backups/pre-change/painelalpha_turso_pre_change_2026-10-20T17-26-08-703Z.sql
```

O comando grava o recibo privado `apply-result.json` somente depois de concluir aplicação e verificação. Se não houver recibo, consultar marcadores e estado antes de repetir: a ausência do arquivo local não prova ausência de commits.

Verificação somente leitura após a carga:

```bash
node scripts/reconciliar-historico-autoria-rd.mjs verify --dir=database-backups/pre-change/rd-historico-autoria-2026-10-20
```

O modo `rollback` exige `--confirm=rollback:4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece`, backup válido e autorização específica. A verificação de reversão usa `verify --state=rollback` com o mesmo diretório.

## Confirmação apresentada e recebida

O agente responsável apresentou o plano e perguntou explicitamente sobre sua aplicação em produção, com este escopo:

> Aplicar o plano `4be6d342…89bece` no Alpha, somente no histórico RD de 237 cards: inserir 122 eventos e atualizar 325 projeções, recuperar autoria comprovada e registrar auditoria, preservando dados comerciais, etapas atuais, responsáveis e o RD.

O usuário respondeu **“Sim vida autorizo”** em 2026-10-20, aproximadamente 18:01 UTC, diretamente à pergunta de aplicação deste lote. Essa resposta autoriza o comando exato de aplicação e não amplia o escopo. A autorização utilizada é esta confirmação nova; não é a autorização anterior das renomeações/configuração do CRM.

## Revalidação imediatamente antes da execução

Leituras locais concluídas em **2026-10-20 18:01:34.966 UTC**, sem consulta ou escrita no banco nesta etapa:

- Fingerprint recalculado e igual ao autorizado: `4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece`.
- Hashes dos três arquivos do executor e hash agregado inalterados em relação à revisão.
- Banco configurado, plano e manifesto apontam para o mesmo identificador seguro.
- Simulação aprovada corresponde ao mesmo fingerprint.
- Manifesto permanece com SHA-256, tamanho, 337 tabelas e 293.950 linhas iguais à evidência de restauração previamente verificada.
- Backup com aproximadamente **32 minutos**, dentro das 48 horas.
- Fonte com aproximadamente **15 minutos**, dentro das 24 horas.

Esta revalidação não repetiu a restauração pesada: o próprio CLI deve restaurar/verificar o dump novamente antes da escrita, como previsto no código revisado. Se qualquer guarda de banco, arquivo, validade ou concorrência falhar, o executor deve interromper; não contornar a proteção.

## Execução concluída e evidências posteriores

Vault leu os três artefatos privados produzidos pelo responsável pela aplicação, todos vinculados ao fingerprint autorizado `4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece`. Esta etapa de encerramento não executou consultas ou escritas no banco.

| Evidência | Timestamp UTC em 20/10/2026 | Resultado |
| --- | --- | --- |
| `apply-result.json` | 18:02:56.803 | **447 operações aplicadas**, zero ignoradas; **1.341 guardas verificadas e coincidentes**. |
| `verification.json` | 18:03:38.407 | Verificação posterior somente leitura: **1.341 guardas verificadas e coincidentes**. |
| `post-apply-reconciliation.json` | 18:04:52.414 | Reconciliação com a coleta aprovada: **zero diferenças restantes**, 12.483 eventos sem necessidade de nova mudança. |

A conferência final registra:

- **1.234 cards e 1.221 vínculos**, preservando o universo inventariado.
- **12.483 eventos** após as 122 inserções.
- Os **12.361 payloads brutos dos eventos originais foram preservados**.
- As **7.994 correções originais foram preservadas**; o total passou a **8.319**, coerente com as 325 correções acrescentadas.
- **447 marcadores `RD_COMPLEMENTO_IMPORTADO`**, coerentes com as operações autorizadas.
- Zero inserções/atualizações pendentes em nova comparação com a mesma coleta.
- Permanecem as limitações de origem já informadas: 7.177 históricos de etapa sem autor identificado, 71 nomes de etapa indisponíveis e 2 campos de data de tarefa ausentes. Não foram preenchidos com suposições.

Não houve rollback. A ausência de diferenças refere-se à coleta aprovada concluída em **17:46:24 UTC**, não a futuras alterações realizadas no RD depois desse instante.

## Decisão final desta revisão

**CONCLUÍDO — plano autorizado aplicado pelo responsável e evidências de verificação/reconciliação conferidas por Vault.** Nenhuma mudança de banco permanece pendente neste lote. Vault não executou a carga ou rollback. Qualquer nova coleta que gere outro lote deve produzir seu próprio plano, revisão e autorização.
