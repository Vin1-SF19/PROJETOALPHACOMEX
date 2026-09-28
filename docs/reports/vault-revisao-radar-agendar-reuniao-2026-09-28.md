# Vault Report — Revisão de Radar / Agendar Reunião — PUBLICAÇÃO AUTORIZADA E VERIFICADA ✅

**Data:** 2026-09-28, auditoria inicial às 13:02 UTC; prévia e backup atualizados às 13:18 UTC; publicação verificada antes das 13:23 UTC.
**Ambiente:** produção remota Turso, identificada por `TURSO_DATABASE_URL` em `.env.local`; `prisma/dev.db` é SQLite local e não representa o banco remoto. Não registrar URL completa, token ou dados pessoais neste relatório.
**Pipeline alvo:** Revisão de Radar, ID `cmuih48la000009gmzw3wwuzf`, ativo, `configVersion=12` conforme inventário informado ao Vault.
**Etapa alvo:** Agendar Reunião, ID `draft-stage-3dc45c6e-2b99-4fd7-bb41-0adfd47ba162`.
**Estado da auditoria:** prévia somente leitura do script de publicação e backup dedicado novo verificado, seguidos da publicação transacional autorizada. Nenhuma migration de schema foi executada.

## Escopo pedido pelo usuário

- Ao mover de Novo Lead para Agendar Reunião, abrir escolha de atribuição ao próprio usuário ou a outro usuário. Esta é regra de aplicação; não autoriza atualização em massa de responsáveis.
- Data e hora da reunião obrigatórias para sair de Agendar Reunião. Próximo Contato interrompe a cadência automática.
- Enquanto não houver Próximo Contato, uma ligação registrada por dia, por oito dias úteis, conforme a cadência de Novo Lead; após esgotamento, mover automaticamente para Stand By. Feriados nacionais devem ser excluídos como na regra anterior.
- Somente Reunião Agendada e Stand By como destinos permitidos de Agendar Reunião; o inventário recebido aponta oito saídas atualmente permitidas.
- Disponibilizar botão Google Meet. Script comercial permanece vazio para configuração posterior na UI, conforme decisão do usuário.
- Campos e formulário devem aparecer nas configurações da etapa e do pipeline. A cadência deve aparecer em Configurações > Cadências, onde pode ser editada ou excluída.

## Estruturas existentes e classificação preliminar

O schema já possui `BpmCard.dataReuniao` (data e hora combinadas), `BpmCard.proximoContatoEm`, `BpmEtapaFormulario` com seções/componentes, `BpmCadencia` com passos e associação por etapa, `BpmTransicaoEtapa` e `BpmPipelineConfigAuditoria`. O inventário informado confirma `BpmEtapaFormulario` ausente, `BpmEtapa.capabilitiesJson=null` e `BpmEtapa.script=null`. O plano técnico recebido usa `dataReuniao` e `proximoContatoEm` como valores canônicos e cria **zero `BpmCampo`**, evitando valores duplicados. Data/hora e Próximo Contato serão expostos como campos do sistema na UI de Campos e como componentes nativos `MEETING_SCHEDULER` e `FOLLOW_UP_SCHEDULER` no formulário; conferir se os bindings e a administração reconhecem essas chaves antes da publicação. **Não há migration de schema prevista**. Se o desenho passar a exigir nova coluna, tabela, índice, constraint, tipo ou backfill, este relatório deixa de cobrir a operação: gerar `prisma migrate diff --script`, classificar cada statement e refazer o checkpoint Vault.

| Operação proposta | Classificação | Impacto e condição |
| --- | --- | --- |
| `INSERT` de um `BpmEtapaFormulario`, uma `BpmFormularioSecao` e dois `BpmFormularioComponente` para `MEETING_SCHEDULER` e `FOLLOW_UP_SCHEDULER` | 🟢 aditiva | Exibe dados nativos no formulário. Zero `BpmCampo` no plano. |
| `UPDATE` de uma `BpmEtapa.capabilitiesJson`: `null` → JSON `["MEETING_SCHEDULER","FOLLOW_UP_SCHEDULER"]` | 🟡 mudança operacional restrita | Torna as capacidades reconhecidas pelo editor/runtime; preservar demais atributos da etapa, inclusive `script=null`. Usar comparação do valor anterior. |
| `INSERT` de uma `BpmCadencia`, oito `BpmCadenciaPasso` do tipo `LIGACAO` e uma `BpmCadenciaEtapa` | 🟢 aditiva com efeito operacional | Passa a aparecer em Configurações > Cadências e poderá ser editada ou excluída; validar colisão da associação única por etapa, dias úteis, pausa e não duplicação. Os intervalos publicados serão `[0,1,1,1,1,1,1,1]`; a interpretação de dias úteis depende do runtime. |
| `UPDATE` restrito de seis transições de saída de Agendar Reunião | 🟡 mudança operacional | Desligar as seis outras saídas; preservar Reunião Agendada e Stand By. Pode bloquear movimentações antes permitidas; listar arestas/IDs/estado anterior em prévia. |
| `UPDATE` de um `BpmPipeline.configVersion` 12 → 13 e `INSERT` de uma `BpmPipelineConfigAuditoria` | 🟡 concorrência | Usar transação, comparação da versão 12 e registrar administrador real; abortar se o estado remoto divergir. Não há formulário preexistente para atualizar a versão. |
| `UPDATE` de `BpmEtapa.script` | Fora do escopo | O usuário decidiu configurar o script depois na UI; a publicação deve preservar o valor atual. |
| `DELETE`, `DROP`, `ALTER`, backfill ou mutação de cards existentes | Fora do escopo | Exigiria novo plano e autorização específica. |

**Prévia exata:** `scripts/configurar-agendar-reuniao-radar.mts --preview` fixou pipeline `cmuih48la000009gmzw3wwuzf`, etapa `draft-stage-3dc45c6e-2b99-4fd7-bb41-0adfd47ba162` e versão 12. Planejou **15 inserts** (1 formulário, 1 seção, 2 componentes, 1 cadência, 8 passos, 1 associação e 1 auditoria) e **8 updates** (1 pipeline, 1 etapa e 6 transições). As duas saídas preservadas foram Reunião Agendada e Stand By. O script exigiu que as oito saídas estivessem inicialmente permitidas e que etapa/formulário/cadência não tivessem mudado; dentro da transação fez CAS da versão 12, releu os elementos críticos e exigiu que seis transições fossem alteradas. A conta de auditoria foi Vinicius (TI), `usuarios.id=8`.

**Diff estrutural:** `git diff --quiet HEAD -- prisma/schema.prisma` confirmou que o schema Prisma não mudou nesta árvore de trabalho. `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` retornou `-- This is an empty migration.`; esta checagem apenas confirma ausência de SQL no diff do mesmo datamodel e não substitui uma comparação com o banco remoto se surgir migration futura. Nenhum statement `CREATE`, `ALTER` ou `DROP` integra este plano.

## Plano de execução e validação exigido

1. Gerar prévia **somente leitura** no Turso: confirmar pipeline/etapa/versão, ausência de formulário, `capabilitiesJson=null`, `script=null`, cadências e oito arestas de saída; mostrar valores anteriores e valores planejados, sem dados pessoais. Confirmar que as duas saídas desejadas estão presentes e que as outras seis são as únicas a desligar.
2. Revisar o script CLI de publicação `scripts/configurar-agendar-reuniao-radar.mts` e sua prévia; confirmar que não há mudança em `prisma/schema.prisma` nem no script comercial. Se houver migration, executar `prisma migrate diff --script` e classificar cada statement antes de nova decisão Vault.
3. **Concluído:** backup completo novo e dedicado do Turso em `database-backups/pre-change/`, anterior a qualquer escrita de configuração. Revalidar idade máxima de 48 horas no instante do `--apply`.
4. **Concluído:** `node scripts/verify-turso-backup.mjs <dump.sql> <manifest.json>` retornou `verified:true` após restauração isolada, com hash/tamanho/contagens, `integrity_check=ok` e `foreign_key_check` sem violações. Repetir a verificação imediatamente antes da escrita.
5. **Concluído:** plano exato, impactos, riscos, alternativa e rollback foram apresentados; o usuário deu **autorização explícita para esta mudança em Agendar Reunião**. A autorização anterior para Novo Lead não foi usada como consentimento.
6. **Concluído:** backup e estado remoto foram revalidados imediatamente antes da transação. O comando aplicado foi `npx tsx scripts/configurar-agendar-reuniao-radar.mts --apply --backup=<dump.sql> --manifest=<manifest.json> --expect-version=12 --admin-id=8 --approval=CONFIGURAR_AGENDAR_REUNIAO_REVISAO_RADAR`, com os caminhos reais do backup dedicado nos argumentos correspondentes.
7. Após commit, ler o Turso e conferir apenas os dois destinos permitidos, campos nativos e formulário na UI de configuração, cadência editável/excluível, versões, auditoria, preservação de cards e `PRAGMA foreign_key_check` sem violações. Homologar o comportamento do runtime e do botão Meet após deploy do código.

## Impacto, riscos e alternativa

A restrição de saídas altera comportamento operacional imediatamente para qualquer código que consulte a matriz remota. Data/hora obrigatórias podem bloquear a saída de cards antigos até que esses valores sejam informados. A cadência publicada pode gerar novas tarefas ou movimentações quando o executor estiver ativo; criação duplicada de chamadas e movimento indevido são riscos a testar em cópia isolada. **Achado confirmado no código:** a ativação e o executor genéricos de `BpmCadencia` somam `intervaloDias * 86400000` em `src/lib/bpm/cadencias/ativacao-automatica.ts` e `executor.ts`, portanto oito passos com intervalo de um dia representam dias corridos, sem excluir fins de semana/feriados. O runtime deve ser ajustado e validado para dias úteis, pausa por Próximo Contato e respeito a edição/exclusão da cadência antes de ativá-la. Atualização concorrente por outro administrador pode sobrescrever mudanças; exigir comparação de versão e transação.

**Alternativa sem escrita no Turso:** implementar e testar a escolha de responsável, validações, botão Meet e prévia do formulário/cadência em código ou cópia restaurada, mantendo a configuração de produção como está. Isso não disponibiliza os campos do sistema/cadência na UI viva nem restringe as saídas.

## Backup e rollback

O backup anterior de Novo Lead não captura o estado remoto atual. O backup dedicado desta mudança está em `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-28T13-13-20-383Z.sql`, com manifesto homônimo `.manifest.json`; concluído em **2026-09-28T13:18:01.819Z**, com **332 tabelas**, **180.760 linhas**, **170.445.077 bytes** e SHA-256 `5d5417b27e3ae403a78104765e3a4939343d373def84c7d4ee99655491ea20c2`. Às 13:18 UTC, tinha menos de um minuto. A verificação por restauração isolada retornou `verified:true`, com hash/tamanho/contagens, `integrity_check=ok` e zero violações de chave estrangeira. Não versionar o dump nem o manifesto. Antes de aplicar, revalidar integralmente e confirmar que o backup ainda é anterior à publicação.

Rollback pontual, se não houver uso posterior das novas configurações: restaurar em transação os flags originais das seis arestas a partir da prévia/auditoria e `BpmEtapa.capabilitiesJson` ao valor original `null`; desativar ou remover a cadência criada e suas associações/passos; retirar apenas os dois componentes, a seção e o formulário novos sem referências; e reverter versões com controle de concorrência. Não remover `BpmCampo`, pois nenhum será criado neste plano. Se já houver cards, tarefas, execuções de cadência ou edições posteriores, bloquear remoção simples e preparar rollback reconciliado. Restaurar o dump inteiro é último recurso separado, porque sobrescreveria gravações posteriores e não desfaria eventos externos do Google Meet; ensaiar em cópia isolada e solicitar autorização específica.

## Publicação autorizada e verificação posterior

Após receber do usuário a resposta explícita **“Sim, autorizo”** ao plano específico de Agendar Reunião, a equipe repetiu a prévia somente leitura. Ela confirmou a versão 12 e o mesmo escopo de **15 inserts e 8 updates** descrito acima. O backup dedicado foi revalidado com `verified:true` imediatamente antes da operação. Executou-se `scripts/configurar-agendar-reuniao-radar.mts --apply` com versão esperada 12, auditoria para Vinicius (TI), `adminId=8`, e o backup dedicado; o comando concluiu a transação e retornou `configVersion=13`.

A leitura posterior no Turso confirmou `BpmEtapa.capabilitiesJson` com `MEETING_SCHEDULER` e `FOLLOW_UP_SCHEDULER`; formulário ativo com uma seção e dois componentes correspondentes; somente **Reunião Agendada** e **Stand By** como saídas permitidas; cadência ativa ligada à etapa, com oito passos de ligação e intervalos `0,1,1,1,1,1,1,1`; `BpmEtapa.script` permaneceu `null`; e registro de auditoria com `adminId=8`. `PRAGMA foreign_key_check` retornou zero violações. A versão do pipeline é 13. Não houve migration, backfill nem alteração de cards existentes no plano aplicado.

**Gate da publicação da configuração: concluído.** A homologação autenticada na UI e o deploy do código de validações, atribuição, Google Meet e cadência ainda não foram realizados por esta publicação; sua operação real depende dessas etapas. Qualquer mudança adicional de escopo requer novo checkpoint Vault e, quando aplicável, nova autorização.
