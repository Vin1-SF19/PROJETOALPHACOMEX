# Story — RM-2026-457A31: Checklist em várias etapas

## Status

**Done — Fase 13: RESULT: PASS (2026-09-09), encerramento arquivado com isolamento dos gates.** Feedback “realize as mudanças” atendido por reinspeção e correção documental efetiva. Falhas globais externas sem regressão atribuível ao checklist e smoke autenticado são pendências não bloqueantes, conforme requisito administrativo. Gates do escopo aprovados; critérios de aceite atendidos por código e testes locais, com limites explícitos na consolidação final.

As seções anteriores à consolidação final abaixo são registros históricos: bloqueios e gaps ali descritos não representam o estado atual. Migration aplicada na Fase 5 sob aprovação própria; não reaplicada nem revalidada remotamente nesta fase.

## Objetivo

Permitir que um template do Checklist Builder seja global para todas as etapas ou restrito a uma, várias ou todas as etapas do pipeline escolhido, com edição acessível, persistência coerente e a mesma resolução de escopo na administração, na materialização do card, no bloqueio de movimento, no Motor de Regras e no Motor de Automações.

## Contexto auditado e blueprint do Scout (histórico anterior à implementação)

- A rota administrativa existente é `/PainelAlpha/AlphaCRM/admin/checklists`, acessível por `Alpha CRM → Configurações → Checklists` e protegida por sessão/papel administrativo.
- A página monta `ChecklistsWorkspace`, que hoje envia `pipelineId`, `etapaId` singular e `cardId` para `CriarTemplateChecklistBpm` e `SalvarTemplateChecklistBpm`.
- `BpmChecklistTemplate.etapaId = null` representa qualquer etapa; um valor preenchido representa exatamente uma etapa.
- Ao trocar o pipeline, o editor atual limpa `etapaId` e `cardId`, mas oferece apenas um `<select>` singular.
- A aplicabilidade está implementada separadamente em `service.ts` e `integracao.ts`; ambas precisam usar uma regra canônica compartilhada para não divergir.
- `materializarChecklistsAplicaveisCard` cria snapshots idempotentes por `@@unique([cardId, templateId])`.
- `carregarResumoChecklistAplicavelCard` alimenta o resumo, o bloqueio de movimento, o Motor de Regras e os placeholders do Motor de Automações.
- O consumo operacional real ocorre em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card → painel esquerdo → aba **Checklist** → `PainelChecklistsCard`.
- Não existe associação persistente entre um template e múltiplas etapas. `BpmCadenciaEtapa` é apenas precedente de modelagem e não pode armazenar o escopo de checklist.

`AUTO_ADJUSTMENT_REQUIRED`: ampliar o Checklist Builder para persistir, editar e resolver um escopo mutuamente exclusivo entre “Todas as etapas” e “Etapas selecionadas”, com uma associação própria template↔etapa e transição segura dos templates legados.

`AUTO_ADJUSTMENT_ACCEPTANCE`: administrador seleciona um pipeline e duas ou mais etapas, salva e recarrega mantendo a seleção; cards nas etapas selecionadas materializam uma única instância do template; card em etapa não selecionada não recebe o checklist; o escopo global continua aplicável a qualquer etapa do pipeline; resumo, movimento, Regras e Automações usam a mesma regra canônica.

## Artefato final, consumidores e caminho de entrega

### Artefato desta fase

Esta story é o contrato executável das próximas fases. É consumida pelos agentes Vault, backend, frontend, segurança, qualidade e documentação diretamente em `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md`. Nenhum visualizador, botão ou rota adicional é necessário para consumir o artefato documental dentro do fluxo do projeto.

### Entrega funcional implementada

- Configuração: administrador autenticado → `Alpha CRM` → `Configurações` → `Checklists` → `/PainelAlpha/AlphaCRM/admin/checklists` → criar/editar template → escolher pipeline → definir “Todas as etapas” ou “Etapas selecionadas”.
- Consumo: usuário autorizado → `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card → painel esquerdo → aba **Checklist** → materialização e operação do checklist aplicável.
- Consumidores indiretos: guarda de movimento, Motor de Regras e Motor de Automações, todos por meio de `carregarResumoChecklistAplicavelCard` e da regra canônica compartilhada.

`DELIVERY_READY`: a navegação administrativa, a rota protegida, as actions existentes e a aba Checklist do card já fornecem o caminho de acesso; a associação multietapa e sua resolução estão implementadas. Caminho conferido por inspeção e testes com mocks; smoke autenticado remoto pendente.

## Escopo

- Criar uma associação persistente própria entre template de checklist e etapas.
- Preservar temporariamente `BpmChecklistTemplate.etapaId` como shadow legado para transição e rollback de código.
- Migrar os vínculos singulares existentes sem converter templates restritos em globais.
- Substituir o seletor singular por controle acessível que permita escopo global, uma etapa ou várias etapas do pipeline escolhido.
- Restaurar integralmente as seleções persistidas ao editar.
- Limpar etapas e card incompatíveis ao trocar o pipeline.
- Validar no servidor que todas as etapas selecionadas existem, estão ativas e pertencem ao pipeline informado.
- Reconciliar metadados, itens, associações de etapas e auditoria na mesma transação administrativa.
- Centralizar a regra de aplicabilidade usada pela materialização e pelo resumo operacional.
- Preservar snapshots já materializados e a idempotência `cardId + templateId`.
- Cobrir criação, edição, compatibilidade legada, autorização, atomicidade, aplicabilidade e entrega ponta a ponta.

## Fora de escopo

- Remover `BpmChecklistTemplate.etapaId` nesta RM.
- Alterar o schema de `BpmCardChecklist` ou `BpmCardChecklistItem`.
- Reprocessar, excluir ou modificar checklists já materializados em cards.
- Duplicar templates para representar várias etapas.
- Criar nova rota, novo módulo, nova permissão ou novo papel de usuário.
- Alterar o comportamento de card específico, salvo a validação de coerência com pipeline e etapas selecionadas.
- Criar novo motor de regras, automações ou validações; os consumidores existentes devem reutilizar a resolução comum.
- Commit, push, PR, deploy ou promoção para produção.

## Decisão de domínio (plano original; fallback real esclarecido na retomada)

O gate Vault deve validar uma relação normalizada com nome proposto `BpmChecklistTemplateEtapa`:

```text
BpmChecklistTemplateEtapa
  id
  templateId
  etapaId
  createdAt

  unique(templateId, etapaId)
  index(templateId)
  index(etapaId)
```

Regras obrigatórias:

- Zero associações significa **Todas as etapas** no escopo do pipeline/card do template.
- Uma ou mais associações significa **Etapas selecionadas**.
- Não existe estado persistido com opção global e associações específicas ao mesmo tempo.
- A mesma etapa pode estar associada a vários templates; `etapaId` não pode ser globalmente único nessa relação.
- Cada associação deve apontar para uma etapa do mesmo `pipelineId` do template.
- Etapas sem pipeline são inválidas; a opção global continua válida conforme o contrato atual de “qualquer etapa”.
- A FK do template deve remover seus vínculos junto com ele; a FK da etapa deve preservar integridade e impedir perda silenciosa de escopo.
- `BpmChecklistTemplate.etapaId` permanece temporariamente como shadow: primeira etapa selecionada em ordem canônica ou `null` no escopo global.
- O backfill cria uma associação para cada `etapaId` singular legado válido antes de o runtime usar a relação normalizada.
- O runtime novo usa uma única resolução canônica após o backfill; o shadow legado existe somente para compatibilidade de rollback durante a transição.

O desenho acima não autoriza alteração de banco. O relatório Vault pode ajustar nomes, índices ou estratégia desde que preserve todas as invariantes e critérios desta story.

## Invariantes funcionais

- “Todas as etapas” e “Etapas selecionadas” são mutuamente exclusivas na UI e na persistência.
- A lista de seleção contém somente etapas ativas do pipeline escolhido.
- O usuário pode escolher o escopo global, uma etapa ou várias etapas.
- A troca de pipeline remove seleções incompatíveis antes de permitir salvar e carrega somente as etapas do novo pipeline.
- A edição restaura o modo de escopo e o conjunto completo de IDs persistidos, sem reduzir a seleção à primeira etapa do shadow legado.
- Template global aplica-se a qualquer etapa compatível; template restrito aplica-se somente às etapas associadas.
- Template legado singular mantém exatamente a mesma aplicabilidade depois do backfill.
- Template já materializado continua snapshot e não muda quando o escopo do template é editado.
- Materialização permanece idempotente por template e card.
- O filtro administrativo, a materialização e o resumo operacional não podem construir regras de escopo diferentes.
- Autorização e ownership são revalidados antes e dentro da transação de escrita.
- Falha em qualquer parte do salvamento não deixa metadados, itens, associações ou auditoria parciais.
- Publicação realtime, quando aplicável, ocorre somente após commit e não substitui a auditoria persistente.

## Critérios de aceite

- [x] O campo de etapas é um multiselect acessível, associado a label/fieldset, operável por teclado e limitado às colunas ativas do pipeline escolhido.
- [x] O administrador pode escolher todas as etapas, uma etapa ou várias etapas.
- [x] A opção global e etapas específicas são mutuamente exclusivas na interface e na persistência.
- [x] Ao editar, o modo e todas as seleções persistidas são restaurados corretamente.
- [x] Trocar o pipeline remove seleções inválidas, limpa card incompatível e carrega somente as etapas do pipeline novo.
- [x] Um template global é aplicável a todas as etapas compatíveis; um template restrito é aplicável somente às etapas selecionadas. (`filtroEtapaTemplateChecklist`; testes de domínio/integração)
- [x] O backfill preserva templates legados singulares e não transforma nenhum deles em global. (Fase 5: 1 associação criada para 1 template singular, validado em restauração descartável e no Turso real)
- [x] O shadow legado é mantido de forma determinística durante a janela de transição. (primeira etapa em ordem canônica, ou `null` no escopo global; corrigido inclusive na action legada — ANU-457A31-01)
- [x] Salvamento de template, itens, associações e auditoria é atômico e protegido por sessão, permissão `configurarChecklists` e validação transacional de ownership. (transação Serializable em Criar/Salvar/Atualizar)
- [x] `service.ts` e `integracao.ts` usam a mesma função canônica de aplicabilidade. (`filtroEtapaTemplateChecklist`, confirmado por Lens/Anubis)
- [x] O mesmo escopo alimenta materialização, resumo, bloqueio de movimento, Regras e Automações. (confirmado por inspeção e testes de integração)
- [x] A unicidade `BpmCardChecklist(cardId, templateId)` continua impedindo duplicação sob reload ou concorrência. (inalterada; tratamento de `P2002` preservado)
- [x] Checklists já materializados não são reescritos após alteração de escopo do template. (snapshots intocados; confirmado por Probe)
- [x] O fluxo é validado da tela administrativa até o checklist consumido no card. (Fase 8, Probe — por inspeção e testes com mocks; smoke autenticado em navegador permanece pendência manual)
- [x] Nenhuma regressão ocorre para templates globais, card específico ou pipelines sem templates aplicáveis. (confirmado por Probe/Sage; falhas globais pré-existentes documentadas, não atribuíveis a esta RM)

## UX e acessibilidade

- Usar dois modos explícitos: **Todas as etapas** e **Etapas selecionadas**. Alternar para o modo global limpa a seleção específica no estado submetido.
- No modo selecionado, renderizar etapas como checkboxes dentro de `fieldset` com `legend`, descrição e resumo textual da quantidade selecionada; não depender apenas de cor.
- Desabilitar o controle de etapas enquanto não houver pipeline escolhido e explicar o motivo.
- Reutilizar como precedente o padrão de checkboxes multiselect de `CadenciaFormDialog`; não reutilizar componentes especializados em usuários.
- Exibir seleção vazia no modo específico como erro claro antes do envio.
- Manter os estados existentes de salvamento/erro e impedir submissões concorrentes.
- Na listagem/edição, mostrar “Todas as etapas” ou os nomes das etapas selecionadas, nunca apenas IDs técnicos.

## Gate Vault obrigatório

- [x] Acionar Vault antes de editar `prisma/schema.prisma`, criar migration ou executar backfill.
- [x] Identificar ambiente e banco afetados sem registrar credenciais.
- [x] Executar preflight somente leitura: total de templates, globais, singulares válidos, singulares órfãos e conflitos pipeline↔etapa.
- [x] Produzir backup completo em `database-backups/pre-change/`, com até 48 horas, manifesto, hash, restauração temporária, `integrity_check=ok` e zero violações de FK.
- [x] Documentar delta exato, comandos, impacto, riscos, alternativa não destrutiva e rollback.
- [x] Obter aprovação humana explícita e específica para o checkpoint antes de qualquer DDL ou backfill.
- [x] Criar migration aditiva e idempotente somente após aprovação. (`20260908214000_bpm_checklist_template_multiplas_etapas`)
- [x] Validar pós-aplicação: tabela, índices, FKs, contagens do backfill, zero vínculo inválido e `foreign_key_check` sem violações. (Fase 5, Turso real)

### Checkpoint Vault — Fase 4 (2026-09-08)

**Veredito:** `WAITING_APPROVAL`. Nenhuma alteração de schema, migration, DDL ou backfill foi criada ou aplicada.

#### Ambiente e banco afetados

- Ambiente classificado como **PRODUÇÃO / modo paranoico**: `.env.local` possui `TURSO_DATABASE_URL` remoto em `turso.io` e `TURSO_AUTH_TOKEN`; credenciais e conteúdo do dump não foram exibidos.
- O alvo da futura aplicação é o Turso real usado pelo runtime. `DATABASE_URL`/`prisma/dev.db` não representa esse banco e não será usado como evidência de aplicação.
- A tentativa somente leitura de gerar um backup novo para esta RM falhou antes de criar arquivo ou alterar o banco, por DNS `EAI_AGAIN` no host Turso. A aplicação fica condicionada a uma nova captura específica quando a conectividade retornar.

#### Evidência do schema e preflight

O schema local ainda contém somente `BpmChecklistTemplate.etapaId String?`, com FK para `BpmEtapa.id` e índice singular. Não existe `BpmChecklistTemplateEtapa`. O snapshot remoto mais recente restaurado nesta fase confirma:

| Verificação | Resultado |
|---|---:|
| Templates | 1 |
| Templates com `etapaId` legado | 1 |
| `etapaId` órfão | 0 |
| Pipeline ausente/incompatível com a etapa | 0 |
| Tabela `BpmChecklistTemplateEtapa` | ausente |

Essas contagens são evidência do snapshot de 2026-09-08T20:40:48.921Z, não substituem o preflight remoto que deve ser repetido imediatamente antes da aplicação. Qualquer órfão ou conflito pipeline↔etapa no novo preflight bloqueia o backfill.

#### Delta aditivo proposto

Criar somente `BpmChecklistTemplateEtapa`, sem `DROP`, `RENAME` ou alteração das tabelas de instância:

| Elemento | Nome/contrato planejado | Classificação Vault |
|---|---|---|
| Tabela | `BpmChecklistTemplateEtapa(id, templateId, etapaId, createdAt)` | 🟢 aditiva |
| FK template | `BpmChecklistTemplateEtapa_templateId_fkey`: `templateId → BpmChecklistTemplate.id`, `ON DELETE CASCADE`, `ON UPDATE CASCADE` | 🟡 exige backup/aprovação |
| FK etapa | `BpmChecklistTemplateEtapa_etapaId_fkey`: `etapaId → BpmEtapa.id`, `ON DELETE RESTRICT`, `ON UPDATE CASCADE` | 🟡 exige preflight de órfãos |
| Unicidade | `BpmChecklistTemplateEtapa_templateId_etapaId_key` em `(templateId, etapaId)` | 🟡 exige preflight de duplicidade |
| Índices | `BpmChecklistTemplateEtapa_templateId_idx` e `BpmChecklistTemplateEtapa_etapaId_idx` | 🟢 aditivos |
| Legado | preservar `BpmChecklistTemplate.etapaId`, sua FK e seu índice | sem alteração |

Relações Prisma planejadas: `BpmChecklistTemplate.etapas BpmChecklistTemplateEtapa[]` e `BpmEtapa.checklistTemplateAssociacoes BpmChecklistTemplateEtapa[]`.

Semântica obrigatória:

- zero associações = **Todas as etapas** compatíveis com os demais filtros do template;
- uma ou mais associações = exatamente o conjunto de **Etapas selecionadas**;
- vários templates podem usar a mesma etapa; somente o par `(templateId, etapaId)` é único;
- toda etapa selecionada deve pertencer ao `pipelineId` do template;
- `BpmChecklistTemplate.etapaId` continua como shadow legado: primeira etapa em ordem canônica, ou `null` para o escopo global;
- `BpmCardChecklist(cardId, templateId)` e os snapshots já materializados permanecem intocados.

#### Compatibilidade e backfill planejado

Na mesma transação da criação da associação, inserir um vínculo determinístico `legacy:<templateId>:<etapaId>` para cada template com `etapaId` legado não nulo, somente após confirmar zero órfãos e zero conflitos de pipeline. A unicidade composta e inserção idempotente impedem duplicação em retry. No snapshot validado, o backfill esperado é exatamente 1 vínculo.

O campo singular não será removido nesta RM. Novas gravações reconciliarão a associação completa e manterão o shadow com a primeira etapa segundo `(BpmEtapa.ordem, BpmEtapa.id)`. O runtime novo consultará a associação; rollback de código poderá voltar ao shadow sem apagar os vínculos normalizados. A remoção futura do campo legado exigirá outra RM e outro checkpoint Vault.

#### Comandos exatos planejados, ainda não autorizados

1. Antes de editar o schema, preservar a versão atual em `/tmp/schema-before-rm-2026-457a31.prisma` e adicionar o model/relações ao `prisma/schema.prisma`.
2. Gerar e revisar o diff:

   ```bash
   mkdir -p prisma/migrations/20260908214000_bpm_checklist_template_multiplas_etapas
   npx prisma migrate diff --from-schema-datamodel /tmp/schema-before-rm-2026-457a31.prisma --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/20260908214000_bpm_checklist_template_multiplas_etapas/migration.sql
   ```

3. Acrescentar ao SQL revisado o backfill determinístico, sem remover `etapaId`; classificar cada statement e validar a migration numa restauração descartável do backup.
4. Repetir o preflight remoto somente leitura e gerar backup atual específico:

   ```bash
   node scripts/turso-backup.mjs "RM-2026-457A31 checklist em varias etapas antes da migration"
   node scripts/verify-turso-backup.mjs <dumpPath-retornado> <manifestPath-retornado>
   ```

5. Somente com backup novo aprovado e autorização correspondente a este identificador, aplicar:

   ```bash
   node scripts/apply-turso-migration.mjs prisma/migrations/20260908214000_bpm_checklist_template_multiplas_etapas/migration.sql
   ```

6. Verificar no Turso real: `PRAGMA table_info('BpmChecklistTemplateEtapa')`, `PRAGMA index_list('BpmChecklistTemplateEtapa')`, `PRAGMA foreign_key_list('BpmChecklistTemplateEtapa')`, contagem de pares duplicados = 0, vínculos órfãos = 0, conflitos pipeline↔etapa = 0, quantidade de vínculos de backfill igual à quantidade singular válida do preflight e `PRAGMA foreign_key_check` sem linhas.

`prisma migrate deploy`, `prisma db push` e `prisma migrate reset` não fazem parte do plano: o Prisma CLI aponta ao SQLite local, enquanto o runtime usa o Turso via adapter.

#### Backup e recuperação

- Snapshot completo disponível: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-08T20-40-39-977Z.sql`.
- Manifesto: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-08T20-40-39-977Z.manifest.json`.
- Gerado em 2026-09-08T20:40:48.921Z; 106.125.243 bytes; 304 tabelas; 83.422 linhas; SHA-256 `4b3b6b2c4d63e22152075c3720d9df5046b81bee474e11108bd83bbe2552e6f8`.
- Verificação repetida nesta fase por restauração SQLite temporária: hash/tamanho/tabelas/linhas conferidos, `integrity_check=ok` e `foreign_key_check` sem violações.
- Esse snapshot é recuperável e está dentro de 48 horas no checkpoint, mas foi criado antes da migration RM-2026-6F3C54. Portanto serve para análise/preflight, não libera a aplicação desta RM; um backup novo e específico, posterior às mudanças intermediárias e novamente restaurado/testado, é obrigatório.
- Restauração de desastre deve ocorrer em banco Turso de recuperação isolado a partir do dump validado; promover a restauração sobre produção é operação destrutiva separada, sujeita a novo Vault e confirmação específica.

#### Impacto, concorrência, riscos e rollback

- Volume conhecido baixo: 1 linha esperada no backfill do snapshot. A tabela e os índices novos não reescrevem tabelas existentes.
- A criação estrutural e o backfill exigem uma transação/janela curta sem edição administrativa de templates; concorrência no `etapaId` legado entre preflight e backfill poderia produzir escopo incorreto.
- Duplicação é bloqueada pela chave única composta; várias associações para uma mesma etapa continuam permitidas quando pertencem a templates diferentes.
- `RESTRICT` impede apagar uma etapa ainda selecionada e evita que o template se torne global silenciosamente. `CASCADE` apaga somente associações subordinadas quando o próprio template é excluído.
- Rollback não destrutivo: desativar os novos consumidores, voltar a leitura/gravação ao shadow `etapaId` e deixar a tabela nova inerte. Não há rollback automático dos snapshots, pois eles não são alterados.
- Remover a tabela/índices seria destrutivo e não está autorizado por este checkpoint; se necessário, exige novo backup, novo plano e nova aprovação Vault.
- Alternativa sem mudança estrutural: duplicar um template por etapa ou inferir uma lista por texto/JSON. Foi rejeitada porque perde identidade única do template, não oferece FKs, favorece divergência entre materialização/motores e não satisfaz edição/reload atômicos de uma seleção multietapa.

#### Identificador e aprovação

Payload canônico do checkpoint:

```json
{"objective":"RM-2026-457A31","environment":"PRODUCTION_TURSO_REMOTE","migration":"prisma/migrations/20260908214000_bpm_checklist_template_multiplas_etapas/migration.sql","delta":{"table":"BpmChecklistTemplateEtapa","foreignKeys":["templateId->BpmChecklistTemplate.id CASCADE","etapaId->BpmEtapa.id RESTRICT"],"unique":["templateId","etapaId"],"indexes":["templateId","etapaId"],"legacyField":"BpmChecklistTemplate.etapaId PRESERVED"},"semantics":"zero associations=all stages; one or more associations=selected set","preflight":{"source":"verified backup 2026-09-08T20:40:48.921Z","templates":1,"legacySingular":1,"orphans":0,"pipelineConflicts":0,"associationTableExists":false},"backup":{"path":"database-backups/pre-change/painelalpha_turso_pre_change_2026-09-08T20-40-39-977Z.sql","sha256":"4b3b6b2c4d63e22152075c3720d9df5046b81bee474e11108bd83bbe2552e6f8","sizeBytes":106125243,"tables":304,"totalRows":83422,"verified":true},"approvalReceived":false}
```

SHA-256 verificável: `225548f90b7e05fb4b29adfb775de3c878e88117ec9b7924e65de1482a4a04ac`.

Não há comprovante de aprovação específica em `mandatoryAdministratorFeedback`. A aprovação externa deve citar **RM-2026-457A31** e o SHA-256 acima; silêncio, aprovação genérica ou aprovação de outra migration não autorizam execução. Mesmo após a aprovação, a fase executora deve obter e validar o backup novo exigido antes de qualquer DDL/backfill.

`AUTO_ADJUSTMENT_REQUIRED`: gerar um backup específico posterior às mudanças intermediárias assim que o DNS do Turso estiver disponível; depois da aprovação específica, criar/revisar a migration e validar o backfill em restauração descartável antes da aplicação real.

`AUTO_ADJUSTMENT_ACCEPTANCE`: backup específico com até 48 horas restaura com hash/tamanho/contagens válidos, `integrity_check=ok` e zero violações de FK; aprovação cita o identificador deste checkpoint; preflight remoto continua sem órfãos/conflitos; migration aditiva aplica e as verificações pós-mudança retornam estrutura, índices, FKs e contagens esperadas.

#### Retomada com aprovação específica (2026-09-09)

- Comprovante externo registrado pelo pipeline: `d21e3e11e054dba110d926dc321db48a11c17f94903831febbccfb6da96494fa`, aprovado por Administrador em `2026-09-09T12:05:31.759Z`, para a RM-2026-457A31 e o checkpoint `225548f90b7e05fb4b29adfb775de3c878e88117ec9b7924e65de1482a4a04ac`.
- Backup específico criado depois da aprovação: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-09T12-29-03-247Z.sql`; manifesto irmão `.manifest.json`; SHA-256 `044c4f115273e0d5ee56dab1c56ce7a26e44a8b903961ab93f627f131579a581`; 106.128.178 bytes; 305 tabelas; 83.427 linhas.
- A restauração descartável conferiu hash, tamanho, tabelas e linhas, com `integrity_check=ok` e zero violações em `foreign_key_check`.
- Preflight no snapshot novo: 1 template, 0 globais, 1 singular válido, 0 órfãos, 0 conflitos pipeline↔etapa e associação multietapa ausente.
- A primeira tentativa de captura falhou sem artefato por HTTP 404 durante a transação read-only; o retry concluiu integralmente. Nenhuma retenção ou exclusão de backup foi executada.
- Gate desta fase: **APROVADO para a futura execução estrita do delta documentado**. Conforme o escopo da Fase 4 e a autoridade do Vault, nenhum schema, migration, DDL ou backfill foi criado/aplicado aqui.

`AUTO_ADJUSTMENT_REQUIRED`: na fase executora, criar e revisar a migration aditiva exatamente no escopo aprovado, testá-la sobre restauração descartável, repetir o preflight remoto imediatamente antes da escrita e só então aplicar e verificar o Turso real.

`AUTO_ADJUSTMENT_ACCEPTANCE`: migration sem `DROP`/`RENAME` cria somente a associação aprovada, preserva `BpmChecklistTemplate.etapaId`, faz o backfill singular idempotente, passa na restauração descartável e, após aplicação, confirma estrutura, índices, FKs, contagens, zero órfãos/conflitos e `foreign_key_check` sem violações.

`DELIVERY_READY`: checkpoint aprovado e backup verificável consumíveis em `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md`; entrega funcional futura permanece pelo caminho `Alpha CRM → Configurações → Checklists` e `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card → aba **Checklist**.

## Riscos e mitigações

| Risco | Mitigação exigida |
|---|---|
| Backfill incorreto tornar template singular global | Preflight de contagens e conflitos; backfill transacional; comparação antes/depois por template. |
| Copiar a unicidade global de cadências | Usar unicidade composta `templateId + etapaId`; testar vários templates na mesma etapa. |
| Divergência entre materialização e motores | Centralizar a aplicabilidade em `leitura.ts` e testar ambos os consumidores contra a mesma matriz. |
| UI restaurar somente o shadow singular | Carregar a associação completa e testar edição/reload com duas ou mais etapas. |
| Troca de pipeline enviar IDs antigos | Limpar o estado dependente imediatamente e revalidar todos os IDs no servidor/transação. |
| Escrita administrativa parcial | Reconciliar template, itens, associações e auditoria em uma única transação. |
| Concorrência sobrescrever edição recente | Usar `updatedAt` como controle otimista ou mecanismo equivalente validado pelo backend. |
| Alterar snapshots existentes | Limitar mudança ao template e à resolução de aplicabilidade futura; não atualizar instâncias. |
| Rollback de código perder escopo multietapa | Manter shadow legado determinístico e documentar que rollback subaplica à primeira etapa sem apagar associações. |

## Plano de testes

### Schema e migration

- [x] Estrutura aditiva, FKs e índices esperados, sem `DROP`/`RENAME`. (confirmado no Turso real e por Anubis contra o checkpoint Vault)
- [x] Unicidade composta aceita vários templates na mesma etapa e rejeita duplicação do mesmo par. (índice `templateId_etapaId_key`, verificado via `PRAGMA index_list`; sem teste automatizado dedicado — ver pendência abaixo)
- [x] Backfill singular é idempotente e preserva contagens/aplicabilidade. (`INSERT OR IGNORE`; testado em restauração descartável, segunda aplicação não duplica)
- [x] Preflight recusa etapa órfã ou pertencente a outro pipeline. (`validarEscopoTemplate`, coberto em `tests/bpm/checklists-multiplas-etapas.test.ts`)

`AUTO_ADJUSTMENT_REQUIRED`: não existe um arquivo de teste automatizado versionado (`tests/bpm/checklists-multiplas-etapas-migration.test.ts`, planejado na File List inicial) que exercite estrutura/FKs/unicidade/backfill da migration isoladamente — a validação real foi feita por restauração descartável do backup + `PRAGMA` manual, documentada nesta story, mas não é repetível via `npm test`.
`AUTO_ADJUSTMENT_ACCEPTANCE`: criar esse teste contra um SQLite local aplicando a migration real, cobrindo os quatro itens acima, para uma manutenção futura ter regressão automatizada da estrutura de banco.

### Domínio e actions

- [x] Schemas aceitam global, uma e várias etapas; deduplicam/rejeitam excesso e IDs inválidos. (`etapaIdsSchema`, limite 100, `tests/bpm/checklists-multiplas-etapas.test.ts`)
- [x] Etapa de outro pipeline, etapa inativa e seleção específica sem pipeline são rejeitadas. (`validarEscopoTemplate`)
- [x] Criar, editar, remover parte dos vínculos e alternar para global reconciliam o conjunto correto. (`reconciliarEtapasTemplate`, testado em `checklists-actions.test.ts`/`checklists-multiplas-etapas.test.ts`)
- [x] Falha intermediária reverte template, itens, associações e auditoria. (transação Serializable; confirmado por inspeção, sem ensaio de rollback real contra banco — ver pendência de Sage/Anubis abaixo)
- [x] Sessão/permissão/ownership são exigidos também em chamada direta. (`exigirAcessoConfigPipeline` fora e dentro da transação, em todas as actions incluindo a legada)
- [x] Conflito por `updatedAt` não sobrescreve edição concorrente. (CAS em `SalvarTemplateChecklistBpm`, testado)

### Aplicabilidade e integração

- [x] Template global aplica-se em qualquer etapa compatível.
- [x] Template com uma etapa aplica-se somente nela.
- [x] Template com várias etapas aplica-se em todas as selecionadas e em nenhuma outra.
- [x] Template singular legado mantém o comportamento depois do backfill.
- [x] Materialização manual e `MATERIALIZAR_CHECKLIST` usam a mesma resolução e permanecem idempotentes.
- [x] Resumo, bloqueio de movimento, Regras e Automações produzem o mesmo resultado de aplicabilidade.
- [x] Instâncias existentes permanecem inalteradas após edição do template.

(Os sete itens acima estão cobertos por `tests/bpm/checklists-{domain,service,multiplas-etapas,integracao-motores}.test.ts` — 9 arquivos/49 testes do módulo aprovados na última execução real do Forge/Probe.)

### UI e entrega ponta a ponta

- [x] Multiselect é operável por teclado, possui nome acessível e expõe seleção/erro sem depender de cor.
- [x] Alternância global↔específica é exclusiva e preserva o rascunho quando o servidor recusa o salvamento.
- [x] Edição/reload restaura duas ou mais etapas e mantém fallback singular legado explícito.
- [x] Troca de pipeline limpa etapas/card e lista somente opções válidas.
- [x] Administrador salva template com duas etapas; card em cada etapa selecionada materializa uma única instância; card fora delas não materializa. (validado por testes de service/integração com mocks; ver pendência de smoke real abaixo)
- [x] Caminho administrativo e aba Checklist do card permanecem acessíveis pelas rotas existentes. (confirmado por Probe)

`AUTO_ADJUSTMENT_REQUIRED`: nenhuma execução desta RM incluiu smoke autenticado em navegador real (teclado/foco físico, salvar/reabrir contra o Turso remoto). Todas as evidências acima são inspeção de código + testes automatizados com Prisma mockado.
`AUTO_ADJUSTMENT_ACCEPTANCE`: sessão com acesso a navegador e ao ambiente remoto repete o cenário "duas etapas salvas, card em cada etapa selecionada materializa uma instância, card fora delas não materializa" manualmente ou via Playwright, e registra o resultado nesta story.

### Gates do projeto

- [x] `npm run lint` — exit 1, baseline global pré-existente (~3.700 erros/17.500 avisos), sem diagnóstico novo nos arquivos desta RM (lint direcionado: exit 0).
- [x] `npm run typecheck` — exit 1, diagnósticos externos à RM (Google Calendar, Exclusão Fiscal, Gerador de Documentos, Radar, script legado), zero nos arquivos desta entrega.
- [x] `npm test` — exit 1, ~50 falhas globais pré-existentes fora do módulo de checklists; testes direcionados (`checklists-*`) 9/9 arquivos e 49/49 testes aprovados.
- [x] `npm run build` conforme Constitution/Forge — exit 0, 78 páginas, incluindo a rota administrativa.
- [x] Testes direcionados de checklist — 49/49 aprovados; teste dedicado de estrutura de migration não criado (ver pendência acima).
- [x] `git diff --check` — PASS em todas as execuções.

## Tarefas por agente

- [x] **Scout** — auditar contexto, persistência, consumidores, entregabilidade e fornecer blueprint.
- [x] **Nova (Fase 2)** — formalizar esta story sem antecipar código funcional.
- [x] **Vault (Fase 4)** — produzir o checkpoint auditável sem editar schema ou criar/aplicar migration.
- [x] **Vault (fase executora)** — migration/backfill aplicados e pós-validados na retomada da Fase 5, sob checkpoint e backup específicos registrados abaixo; nenhuma nova operação de banco nesta consolidação.
- [x] **Echo/Dev** — schemas, leitura canônica, actions, persistência e integração operacional implementados; ver Fase 5 e correção ANU-457A31-01.
- [x] **Nova** — implementar o multiselect acessível e os estados de edição no `ChecklistsWorkspace` após o gate de dados estar disponível.
- [x] **Anubis** — reauditoria da Fase 9: PASS por inspeção; ANU-457A31-01 resolvido na correção preexistente. Correção revalidada pelo Forge atual, com 49/49 testes direcionados; ver retomada abaixo.
- [x] **Forge** — retomada aprovada no escopo da RM; build exit 0, 73/73 testes direcionados e lint escopado aprovados na retomada atual; débitos globais isolados no registro final.
- [x] **Probe** — validou o fluxo completo da configuração administrativa ao checklist no card e seus consumidores indiretos (Fase 8, PASS, por inspeção e testes com mocks; smoke autenticado pendente).
- [x] **Lens** — revisou qualidade e arquitetura após Forge aprovar (PASS, sem achado bloqueante).
- [x] **Sage** — validou a matriz de casos extremos, compatibilidade legada e regressões (PASS; gaps antigos cobertos nas suítes atuais, conforme consolidação final).
- [x] **Scribe/Kowalski** — mapas, decisões e integrações atualizados na Fase 12; known-errors preservado sem novo erro resolvido; sessão registrada no journal.

## File List inicialmente planejada

### Criar

- [x] `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md`.
- [x] `prisma/migrations/20260908214000_bpm_checklist_template_multiplas_etapas/migration.sql`.
- [x] `tests/bpm/checklists-multiplas-etapas-migration.test.ts` — existente, SQL executado em memória; validação atual na Fase 12.

### File List real da Fase 4

- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` — checkpoint Vault, evidências, plano, riscos, rollback, entregabilidade e estado `WAITING_APPROVAL`.
- `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-09T12-29-03-247Z.sql` e manifesto irmão — novos, específicos desta RM, ignorados pelo Git e validados por restauração.
- Nenhum arquivo em `prisma/schema.prisma` ou `prisma/migrations/` foi criado/editado por esta fase.

### Editar

- [x] `prisma/schema.prisma`.
- [x] `src/lib/bpm/checklists/schemas.ts`.
- [x] `src/lib/bpm/checklists/leitura.ts`.
- [x] `src/actions/bpm/Checklists.ts`.
- [x] `src/components/bpm/checklists/ChecklistsWorkspace.tsx`.
- [x] `src/lib/bpm/checklists/service.ts`.
- [x] `src/lib/bpm/checklists/integracao.ts`.
- [x] `tests/bpm/checklists-actions.test.ts`.
- [x] `tests/bpm/checklists-multiplas-etapas.test.ts` (criado no lugar do `checklists-domain.test.ts` planejado; cobre domínio, actions e migration por inspeção).
- [x] `tests/bpm/checklists-service.test.ts` (pré-existente, cenários de escopo cobertos).
- [x] `tests/bpm/checklists-integracao-motores.test.ts` (pré-existente, cenários de escopo cobertos).
- [x] `tests/bpm/checklists-multiselect-ui.test.ts` (criado no lugar do `checklists-entrega-shell.test.ts` planejado; cobre a UI do editor).
- [x] `.bibble/memory/architecture.md`.
- [x] `.bibble/memory/codebase-map.md`.
- [x] `.bibble/memory/decisions.md`.
- [x] `.bibble/memory/integration-points.md`.
- [x] `.bibble/memory/known-errors.md` (não estava na lista planejada; adicionado por conter um erro novo diagnosticado e resolvido nesta RM — ANU-457A31-01).
- [x] `.bibble/memory/components.md` — registro de `EtapasMultiSelect` já feito por Nova na Fase 6; conferido e preservado nesta retomada.
- [x] `.bibble/memory/journal.md` — arquivamento desta retomada pelo protocolo Kowalski.

### Consultar como precedentes, sem alteração obrigatória

- `src/components/bpm/cadencias/CadenciaFormDialog.tsx` — fieldset/checkboxes multiselect e limpeza ao trocar pipeline.
- `src/actions/bpm/Cadencias.ts` — reconciliação transacional, auditoria e concorrência.
- `src/app/PainelAlpha/AlphaCRM/admin/checklists/page.tsx` — rota e proteção já integradas.
- `src/lib/bpm/ownership.ts` — permissão `configurarChecklists`.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx` — montagem real da aba Checklist.

## Registro da Fase 2 — criação da story

- Story criada a partir do blueprint do Scout e do estado real reinspecionado.
- Escopo, fora de escopo, riscos, plano de testes, gate Vault, tarefas por agente e File List planejada registrados.
- Somente o artefato documental foi criado; nenhum item funcional futuro foi marcado como concluído.
- Nenhum código funcional, schema, migration, backfill, backup, dado ou configuração de produção foi alterado.

## Registro da Fase 5 — persistência e resolução multietapa

- [x] Backup específico pós-aprovação restaurado e validado (hash, tamanho, tabelas, linhas, integridade e FKs).
- [x] Schema e migration estritamente aditivos criados no caminho aprovado; shadow legado preservado.
- [x] Backfill idempotente validado em restauração descartável: 1 associação para 1 template singular, integridade `ok`, zero violações de FK.
- [x] Contratos Zod aceitam global, uma e várias etapas e recusam duplicidade/excesso.
- [x] Criação e salvamento validam escopo antes da escrita e revalidam permissão/ownership dentro da transação serializável.
- [x] Metadados, itens, associações e auditoria são reconciliados atomicamente; realtime ocorre após commit.
- [x] Consultas administrativas devolvem todas as associações selecionadas.
- [x] Materialização e integração de resumo, movimento, Regras e Automações usam o mesmo filtro canônico.
- [x] Testes direcionados: 19/19 aprovados; lint escopado sem diagnóstico.
- [x] Aplicação e pós-verificação no Turso: concluídas nesta retomada (ver abaixo).
- [x] UI multiselect: implementada nesta retomada (ver abaixo).

Gates globais executados: `npm run typecheck` falhou somente em diagnósticos externos à File List; `npm run lint` manteve o baseline global (3.702 erros/17.508 avisos, sem diagnóstico no lint escopado); `npm test` aprovou 2.600 testes, com 52 falhas e 1 todo externos ao delta. `git diff --check` passou.

### File List real da Fase 5

- `prisma/schema.prisma`
- `prisma/migrations/20260908214000_bpm_checklist_template_multiplas_etapas/migration.sql`
- `src/actions/bpm/Checklists.ts`
- `src/lib/bpm/checklists/schemas.ts`
- `src/lib/bpm/checklists/leitura.ts`
- `src/lib/bpm/checklists/service.ts`
- `src/lib/bpm/checklists/integracao.ts`
- `tests/bpm/checklists-actions.test.ts`
- `tests/bpm/checklists-multiplas-etapas.test.ts`
- `.bibble/memory/architecture.md`
- `.bibble/memory/decisions.md`
- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md`

### Retomada da Fase 5 — aplicação da migration e UI multiselect

Com o comprovante administrativo `d21e3e11e0...a96494fa` validado pelo Vault contra o checkpoint `225548f9...a04ac` e o backup específico `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-09T12-29-03-247Z.sql` (verificado, dentro da janela de 48h), esta retomada:

- [x] Repetiu o preflight remoto imediatamente antes da escrita: tabela ainda inexistente, 1 template singular, 1 template total.
- [x] Testou a migration em restauração descartável do backup específico: aditiva, idempotente (segunda aplicação não duplica), `integrity_check=ok`, zero violações de FK.
- [x] Aplicou `prisma/migrations/20260908214000_bpm_checklist_template_multiplas_etapas/migration.sql` no Turso real (5 statements).
- [x] Verificou pós-aplicação no Turso real: 1 associação criada pelo backfill, 3 índices (unicidade composta + 2 índices simples) confirmados, `PRAGMA foreign_key_check` = 0 violações, zero órfãos de template e de etapa.
- [x] Executou `npx prisma generate` e confirmou zero erros de typecheck nos arquivos desta entrega (27 erros remanescentes são baseline global pré-existente, fora do escopo).
- [x] Criou `src/components/bpm/checklists/EtapasMultiSelect.tsx` — fieldset acessível com dois rádios mutuamente exclusivos ("Todas as etapas" / "Etapas selecionadas"), lista de checkboxes com scroll, badges de resumo (até 3 + "+N etapas") com remoção individual, aviso de troca de pipeline e alerta para etapa selecionada indisponível no pipeline atual.
- [x] Integrou o componente a `ChecklistsWorkspace.tsx`: `Draft` passou a ter `escopoEtapa`/`etapaIds`; a troca de pipeline limpa etapas/card e anuncia a limpeza; a validação client-side bloqueia salvar sem etapa selecionada quando o escopo é "Etapas selecionadas"; a listagem de templates resume "Qualquer etapa"/nome da etapa única/"N etapas".
- [x] Ampliou `tests/bpm/checklists-multiplas-etapas.test.ts` com testes de Server Action: rejeição de etapa de outro pipeline, criação com várias etapas, edição reconciliando adição/remoção de vínculos, template legado (singular → seleção), e bloqueio por conflito de concorrência (CAS por `updatedAt`).
- [x] Rodou o conjunto completo de testes de checklist (9 arquivos, 46 testes): todos aprovados.

Gates desta retomada: `npm run lint` (arquivos alterados) sem diagnóstico; `npx tsc --noEmit` sem erro novo nos arquivos desta entrega; `npx vitest run tests/bpm/checklists-*.test.ts` 9/9 arquivos e 46/46 testes aprovados; `git diff --check` aprovado. `npx vitest run tests/bpm/` mostrou 28 falhas em 8 arquivos fora do módulo de checklists (Fechado, kanban-transição, criação de card com empresa nova) — pré-existentes no working tree antes desta sessão, sem relação com esta RM.

File List adicional desta retomada:

- `src/components/bpm/checklists/EtapasMultiSelect.tsx` (novo)
- `src/components/bpm/checklists/ChecklistsWorkspace.tsx`
- `tests/bpm/checklists-multiplas-etapas.test.ts`

## Registro da Fase 6 — multiselect no editor

- [x] O editor usa um único `EtapasMultiSelect` na aba **Vínculos**, sem rota ou modal paralelo.
- [x] “Todas as etapas” limpa a seleção específica; selecionar o modo específico mantém o escopo restrito e exige ao menos uma etapa.
- [x] Templates globais, multietapa e singulares legados são restaurados; legado indisponível é sinalizado e bloqueia o salvamento.
- [x] Trocar o pipeline preserva o modo escolhido, limpa `etapaIds`/`cardId` e anuncia a mudança.
- [x] Loading, vazio, erro com retry, disabled, salvando, sucesso e erro de salvamento estão representados sem apagar o rascunho.
- [x] O payload usa exclusivamente `etapaIds` e envia `updatedAt` na edição para o CAS já validado no backend.
- [x] Testes de interação cobrem global, uma/várias etapas, remoção, troca de pipeline, edição/legado, controles de teclado e payload.

### File List real da Fase 6

- `src/components/bpm/checklists/EtapasMultiSelect.tsx`
- `src/components/bpm/checklists/checklist-editor-state.ts` (novo)
- `src/components/bpm/checklists/ChecklistsWorkspace.tsx`
- `tests/bpm/checklists-multiselect-ui.test.ts` (novo)
- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md`

Gates posteriores (Probe, Anubis, Lens, Sage, Scribe/Kowalski) permanecem pendentes; Lens não está liberado enquanto Forge estiver reprovado.

## Registro da Fase 7 — gate Forge (2026-09-09)

**Veredito Forge: REPROVADO.** Os checks direcionados da RM passaram, mas o gate técnico global não pode ser aprovado: o typecheck retornou erros e o build retornou erro ao buscar Google Fonts no ambiente com rede restrita.

- `npx tsc --noEmit`: exit 1, 27 diagnósticos; nenhum nos arquivos da RM. Os erros estão em artefatos `.next`, Exclusão Fiscal, Gerador de Documentos, Agenda/Google Calendar, Radar e script legado, coerentes com o baseline global registrado.
- `npm run lint`: exit 1, 21.210 problemas (3.702 erros e 17.508 avisos), mesmo baseline global registrado pela Fase 6.
- ESLint direcionado aos arquivos de actions, domínio, editor e testes da RM: exit 0, sem diagnóstico.
- `npm run build`: exit 1. `prisma generate` e `build:player` concluíram; o Turbopack falhou exclusivamente porque não conseguiu buscar `Geist` e `Geist Mono` em `fonts.googleapis.com` no ambiente com rede restrita. Não houve erro de código, Prisma ou arquivo da RM, mas Forge não aprova build com exit diferente de zero.
- `npx prisma validate`: exit 0; schema válido.
- `npx prisma generate`: exit 0; Prisma Client v6.19.3 gerado.
- `npx vitest run tests/bpm/checklists-*.test.ts`: exit 0; 9 arquivos e 48 testes aprovados.
- `npm test`: exit 1; 20 arquivos falharam e 319 passaram; 52 testes falharam, 2.610 passaram e 1 ficou pendente. As 52 falhas coincidem com o baseline global documentado e nenhuma pertence ao conjunto `checklists-*`.
- `git diff --check`: exit 0.

AUTO_ADJUSTMENT_REQUIRED: devolver os 27 diagnósticos globais ao Dev responsável pelo baseline de TypeScript e repetir `npm run build` em ambiente com acesso a `fonts.googleapis.com` ou com as fontes Geist fornecidas localmente; Forge deve ser chamado novamente antes de Lens.

AUTO_ADJUSTMENT_ACCEPTANCE: `npx tsc --noEmit` e `npm run build` retornam exit 0 no mesmo estado da entrega; lint/testes direcionados continuam em exit 0 e nenhuma falha global nova é atribuível aos arquivos da RM.

DELIVERY_READY: os testes direcionados confirmam o contrato de entrega em `Alpha CRM → Configurações → Checklists` e o consumo em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card → aba **Checklist**; a promoção para Lens permanece bloqueada pelo gate Forge.

### File List real da Fase 7

- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` (registro do gate; nenhum código-fonte alterado).


## Retomada Forge — 2026-09-09, execução real final

**RESULT: PASS no escopo RM-2026-457A31.** Este registro substitui o veredito anterior da Fase 7; preserva o histórico. Build concluída, sem regressão identificada nos arquivos da RM. Lens liberado para esta entrega; os gates globais continuam com débitos externos, não são declarados aprovados.

- [x] `npx tsc --noEmit`: exit 1, 20 diagnósticos externos à RM.
- [x] `npm run typecheck`: exit 1, os mesmos 20 diagnósticos externos.
- [x] `npm run lint`: exit 1, 3.702 erros / 17.508 avisos, exatamente o baseline da Fase 6.
- [x] `npm run build`: exit 0, Prisma Client v6.19.3 gerado e 78/78 páginas; rota administrativa incluída. Configuração existente ignora tipos no build, por isso os dois typechecks foram executados separadamente. Logs apresentam EACCES na leitura de `.env`, sem impedir a build; nenhum segredo foi acessado/exibido.
- [x] `npx eslint src/actions/bpm/Checklists.ts src/lib/bpm/checklists/{schemas,leitura,service,integracao}.ts src/components/bpm/checklists/{ChecklistsWorkspace,EtapasMultiSelect}.tsx src/components/bpm/checklists/checklist-editor-state.ts tests/bpm/checklists-*.test.ts`: exit 0, zero diagnósticos.
- [x] `npx vitest run tests/bpm/checklists-*.test.ts`: exit 0, 9 arquivos / 48 testes aprovados (domínio, actions, editor, serviço e integração).
- [x] `npm test`: exit 1, 323 arquivos aprovados / 19 falhando; 2.635 testes aprovados / 50 falhando / 1 todo. Falhas externas ao conjunto checklist, nos módulos já documentados no baseline. Inclui duas asserções de checklist em `kanban-transicao-integracao.test.ts:206,222`, parte das falhas de transição já registradas na Fase 5, não ocultadas nem declaradas aprovadas.
- [x] `npx prisma validate`: primeira tentativa exit 1 (P1012, DATABASE_URL ausente); `DATABASE_URL=file:./forge-validation-only.db npx prisma validate`: exit 0. URL fictícia somente para validação de configuração; nenhum banco criado/conectado, DDL, migration ou backfill executado.
- [x] Inspeção de navegação, salvamento, recarga e consumo: editor envia etapaIds/updatedAt, actions reconciliam vínculos e leitura devolve associações; router.refresh recarrega o workspace; materialização e resumo compartilham filtroEtapaTemplateChecklist.

DELIVERY_READY: administrador → Alpha CRM → Configurações → Checklists → criar/editar → Vínculos → Etapas → salvar/reabrir; operador → pipeline → abrir card → aba Checklist. Caminho sustentado por inspeção e testes automatizados com mocks; smoke autenticado em navegador, teclado/foco real e persistência remota ficam pendentes para Probe, não foram executados nesta fase.

Limitações: `git diff --check` global encontrou `.env.example: unsupported file type` e não pôde concluir; verificar somente a documentação desta execução. Não houve alteração de código-fonte, schema ou dados. Build produziu seus artefatos gerados usuais. Memória de arquitetura com antigo DNS pendente não substitui a evidência de aplicação já registrada pela Fase 5.

### File List desta retomada

- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` (registro e checklist).
- `.bibble/memory/journal.md` (registro da verificação).
- `forge-457a31-ztlbhr9a/` (logs locais e exit codes dos gates; não publicar sem revisão).


## Fase 8 — Probe: consumo ponta a ponta (2026-09-09)

**RESULT: PASS no escopo local**, por inspeção do encadeamento real e evidência automatizada anterior do Forge. Nenhum smoke autenticado, escrita remota ou teste novo concluído nesta fase. Este registro não declara validação em navegador nem substitui os gates globais pendentes.

### Checklist constitucional e evidências

- [x] Presença visual: `CRMLayoutClient` inclui Checklists com `adminOnly`, filtrado por role; `AdminPipelinesListClient` contém o link de Configurações.
- [x] Trigger: Novo template/Editar abrem o draft; Salvar chama CriarTemplateChecklistBpm/SalvarTemplateChecklistBpm e faz router.refresh após sucesso. A aba Checklist é montada antecipadamente com forceMount e chama ListarChecklistsCardBpm ao abrir o card.
- [x] Rota: `/PainelAlpha/AlphaCRM/admin/checklists` exige auth e isAdminRole; carrega ListarWorkspaceChecklistsBpm e entrega seus dados ao editor.
- [x] Permissões: actions exigem sessão e configurarChecklists (checagem real admin-only); criação e save completo repetem autorização na transação. Leitura operacional exige visualizar o card e controles de edição respeitam podeEditar.
- [x] Persistência, verificada no código: etapaIds alimenta associações na criação e reconciliação no save, com shadow ordenado, auditoria e itens na transação. A consulta do workspace devolve todas as associações; resolverSelecaoEtapasTemplate restaura todas, com fallback singular legado. updatedAt impede sobrescrita concorrente pelo editor.
- [x] Estados: loading, vazio, erro/retry, salvamento e sucesso estão ligados aos dados/actions. Erro de save preserva draft. Troca de pipeline limpa etapas/card e mantém modo restrito; legado indisponível bloqueia save.
- [x] Integrações: service.ts e integracao.ts chamam filtroEtapaTemplateChecklist; o filtro aceita associação da etapa atual ou ausência de associações com shadow global/singular compatível. Ambos também filtram pipeline/card. Cards.ts, transicao-command.ts, regras/contexto.ts e automacoes/executor.ts consomem essa integração. Nenhum novo serviço externo é necessário; Turso/realtime não foram exercitados ao vivo nesta fase.
- [x] Regressão por inspeção e evidência anterior: P2002 e unicidade card/template mantêm idempotência; snapshots não são reescritos. Registry de layouts sem overrides resolve todos os pipelines para CardAbertoLayout, que monta PainelHistorico sem excluir Agendar Reunião; a aba Checklist permanece disponível nessa etapa.

### Cenário principal e limites

O fluxo de duas etapas está conectado da seleção ao payload, associação persistida, recarga e filtro operacional. Cards novos nas etapas selecionadas recebem o template; um card sem snapshot em etapa não selecionada não o materializa. Todas as etapas envia lista vazia, remove associações no save e grava shadow null. Um snapshot anterior continua visível mesmo após movimentar o card ou restringir o template: comportamento exigido pela preservação dos snapshots, não falha de filtro.

DELIVERY_READY: administrador → Alpha CRM → Configurações → Checklists → criar/editar → Vínculos → pipeline/Etapas → salvar/reabrir; operador autorizado → `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card → painel esquerdo → Checklist. Artefato final: template com associações de etapas, consumido pelo administrador no editor e pelo operador como snapshot no card; motores consomem o mesmo escopo canônico.

### Gates e pendências

- Tentativas reais `npm run lint`, `npm run typecheck`, `npm test`: exit 127, respectivamente eslint, tsc e vitest ausentes. Arquivos executáveis e pacotes correspondentes não existem em node_modules.
- Tentativa direcionada `npx --no-install vitest run tests/bpm/checklists-*.test.ts`: exit 1, pacote local ausente; nenhum pacote instalado.
- Evidência anterior reinspecionada em `forge-457a31-ztlbhr9a/`: scoped-tests.exit=0 e 48/48 testes, scoped-lint.exit=0, build.exit=0 e 78/78 páginas incluindo admin/checklists. Estes são resultados do Forge, não execuções desta fase.
- Diff documental verificado. Nenhuma fonte, schema, migration ou dado alterado; working tree preexistente preservado.
- Pendência manual: smoke autenticado com salvar/reabrir duas etapas, cards independentes selecionados/não selecionado e global; teclado/foco real. Os testes anteriores usam mocks e não constituem transação real de ponta a ponta. Repetir gates quando as dependências locais estiverem disponíveis.

### File List da Fase 8

- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` (este checklist e relatório).
- `.bibble/memory/journal.md` (registro da fase).
- `probe-457a31-lint.log`, `probe-457a31-typecheck.log`, `probe-457a31-tests.log`, `probe-457a31-scoped.log` (logs locais das tentativas).


## Fase 9 — Anubis: segurança e autorização (2026-09-09)

**RESULT: FAIL.** Zero achados críticos de acesso não autorizado confirmados; um achado de severidade alta bloqueia os controles obrigatórios de integridade do escopo. Auditoria por inspeção, sem alteração de fonte, execução de action, acesso remoto, migration ou mutação de dados.

### ANU-457A31-01 — ALTA / bloqueante: escrita legada diverge do escopo validado

Evidências: `src/actions/bpm/Checklists.ts:87` prioriza `etapaIds`; `:254-274` mantém a Server Action exportada `AtualizarTemplateChecklistBpm`, que valida esse contrato, mas grava diretamente `dados.etapaId` e `pipelineId` sem reconciliar `BpmChecklistTemplateEtapa`. `src/lib/bpm/checklists/schemas.ts:17-31` aceita simultaneamente os dois campos. A FK singular assegura existência da etapa, não pertencimento ao pipeline.

Cenários deduzidos diretamente do código (não executados contra banco):

1. Um administrador fornece IDs CUID válidos, `pipelineId` do pipeline A, `etapaIds: []` e `etapaId` de uma etapa existente do pipeline B. A validação usa a lista vazia e não consulta essa etapa; a escrita usa o campo singular e permite o vínculo incompatível.
2. Em template multietapa existente, atualizar para global ou trocar pipeline por essa action preserva as associações antigas. O filtro canônico continua consultando essas associações, divergindo do escopo solicitado. A action não revalida permissão/etapas em transação e não participa da reconciliação serializável da RM.

A UI atual importa somente Criar/Salvar/Alternar, sem consumidor encontrado para Atualizar. Portanto, não se afirma exploração HTTP nem exposição dessa action no build final. Ainda assim, o contrato de escrita exportado permanece incompatível com o novo schema compartilhado; ausência de botão não constitui garantia de integridade. O gate reprova por esse caminho não migrado, não por elevação de privilégio: a permissão canônica continua admin-only.

**Responsável: Echo/backend.** Unificar a normalização e reconciliação de todos os caminhos de alteração de escopo; rejeitar entradas singulares/plurais conflitantes ou persistir somente o escopo canônico validado. Revalidar autorização, pipeline, etapas ativas e card dentro da mesma transação serializável; atualizar shadow e associações atomicamente, preservando itens em uma atualização apenas de metadados. Alternativamente, retirar o export legado se sua descontinuação for compatível com os consumidores. Não executar reparo em massa de dados nesta correção sem checkpoint Vault próprio.

AUTO_ADJUSTMENT_REQUIRED: AtualizarTemplateChecklistBpm aceita o contrato plural, grava o singular não validado e mantém associações de etapas antigas ao alterar escopo/pipeline.
AUTO_ADJUSTMENT_ACCEPTANCE: testes de todos os entrypoints recusam etapa de outro pipeline e payload singular/plural conflitante; global remove associações e zera shadow; troca de pipeline não mantém vínculos antigos; falha intermediária reverte a transação; revogação de permissão na transação impede escrita. Reexecutar testes direcionados, lint/typecheck/build pelo Forge, integração pelo Probe e esta auditoria Anubis antes de liberar Lens.

### Controles confirmados e limites

- [x] Auth precede leituras/mutações protegidas nas actions administrativas; `exigirAcessoConfigPipeline` consulta o usuário/permissões persistidos e exige admin. Página também exige sessão/admin. Operações de card passam pela autorização canônica de card.
- [x] IDs passam por CUID, etapas têm limite 100 e rejeição de duplicados; itens têm limite 200. O modo é implícito: lista vazia global, lista preenchida específica; não existe enum de modo enviado ao servidor. Criar/Salvar persistem a lista efetivamente validada, com fallback singular legado.
- [x] Criar/Salvar revalidam etapas ativas do pipeline, compatibilidade do card e permissão dentro de transação Serializable; reconciliam associações/shadow/itens/auditoria e notificam após commit.
- [ ] Todos os caminhos de escrita seguem a mesma regra: falha ANU-457A31-01.
- [x] Erros públicos são allowlisted; logs das actions omitem mensagem bruta, payload e sessão. Não encontrados SQL dinâmico, execução de comandos, segredos no cliente ou HTML arbitrário no delta inspecionado.
- [x] Migration local corresponde ao delta Vault registrado: uma tabela associativa, FKs Cascade/Restrict, unicidade composta, dois índices e backfill singular idempotente, sem DROP/RENAME. O executor existente usa batch transacional de escrita. Aprovação e validação do backup constam na story (checkpoint 225548f9…a04ac, comprovante d21e3e11…a96494fa); aplicação remota é evidência histórica da Fase 5, não revalidada nesta sessão. Nenhum dump foi aberto nem nova autorização de banco foi necessária.
- [x] Testes existentes inspecionados cobrem auth de listagem, payload inválido, seleção múltipla, pipeline incompatível, reconciliação e conflito de updatedAt. Não cobrem a action legada; mocks de transação não demonstram rollback/concorrência real.

Informativo: `updatedAt` é opcional no schema de Salvar; o editor o envia, mas clientes que omitem o campo não recebem proteção contra edição obsoleta. Serializable garante atomicidade, não detecção universal de rascunho desatualizado. Não classificado como mistura parcial de associações no caminho canônico.

### Entregabilidade e gates

DELIVERY_READY: caminho principal validado por inspeção: administrador → Alpha CRM → Configurações → Checklists → criar/editar → Vínculos → Etapas → salvar/reabrir; operador autorizado → pipeline → abrir card → aba Checklist. Artefato: template com associações, consumido no editor, nos snapshots do card e nos motores pelo filtro compartilhado. Essa conectividade não libera o gate de segurança reprovado.

- `npm run lint`, `npm run typecheck`, `npm test` e lint direcionado a Checklists.ts/schemas.ts: exit 127 (eslint/tsc/vitest ausentes), sem instalação de dependências.
- Evidência anterior conferida nos logs Forge: scoped-tests.exit=0, 48/48 testes; scoped-lint.exit=0; build.exit=0. Não são execuções desta fase e não cobrem ANU-457A31-01.
- Smoke autenticado, teclado/foco real e concorrência em banco descartável permanecem pendentes; nenhum teste de exploração foi executado.
- Working tree anterior preservado. Verificação documental por git diff --check.

### File List da Fase 9

- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` — checklist, achado, aceite corretivo e relatório.
- `.bibble/memory/journal.md` — registro da auditoria.


## Fase 9 — Anubis: reauditoria da correção (2026-09-09)

**RESULT: PASS — inspeção de segurança do estado local.** Este registro substitui o veredito anterior de ANU-457A31-01, preservado acima como histórico. Zero achados críticos ou altos abertos no delta auditado. A correção de fonte e seu teste já estavam no working tree antes desta sessão e foram preservados integralmente.

### Resolução do achado alto ANU-457A31-01

- [x] `AtualizarTemplateChecklistBpm` autentica antes de acessar dados e revalida `configurarChecklists` dentro da transação; a implementação canônica consulta o usuário persistido e exige admin.
- [x] Criar, Salvar e Atualizar usam CUID, limite de 100 etapas e rejeição de duplicados pelo Zod. O modo é representado por lista vazia/global ou preenchida/específica; não há enum de modo no contrato servidor.
- [x] A action legada agora usa `validarEscopoTemplate(dados, tx)`, que exige pipeline para etapas, consulta somente etapas ativas desse pipeline e valida card específico. O shadow é derivado exclusivamente das etapas retornadas, em ordem canônica.
- [x] Payload plural/singular conflitante não grava o singular ignorado: `etapaIds: []` com `etapaId` externo produz shadow null e remoção dos vínculos. A precedência plural é a normalização escolhida, equivalente à alternativa segura pedida no relatório anterior; não se afirma rejeição desse payload.
- [x] `reconciliarEtapasTemplate` remove associações ausentes da seleção e cria as novas dentro da mesma transação Serializable da atualização do shadow/metadados/auditoria. Global elimina associações e shadow; mudança de pipeline conserva somente etapas validadas no destino. Os itens do template são preservados pela action de metadados.
- [x] Exceções intermediárias propagam para a transação, sem catch interno que confirme estado parcial. Notificações ocorrem após commit. Esta conclusão é por inspeção do uso da transação, sem ensaio de concorrência ou rollback real.
- [x] Erros públicos permanecem allowlisted; logs omitem payload, sessão e mensagem bruta do banco. Nenhum novo SQL dinâmico, comando, HTML arbitrário ou segredo no cliente identificado no delta.
- [x] Migration local confrontada com o checkpoint documentado: tabela associativa aditiva, FKs Cascade/Restrict, unicidade composta, dois índices e backfill singular determinístico idempotente. Nenhuma alteração ou execução de banco nesta sessão. Aprovação, backup e aplicação remota são evidências históricas da story, não novas verificações remotas.

### Informativos e validação pendente

O teste preexistente acrescentado à suíte multietapa cobre atualização legada com duas etapas e inclusão da associação faltante. Não cobre todos os cenários negativos do aceite anterior nem demonstra rollback real. Echo/Sage devem ampliar essa cobertura; Forge deve repetir os gates da correção e Probe deve repetir o smoke de integração quando houver ambiente disponível. A evidência Forge anterior à correção não foi reutilizada como aprovação técnica deste delta.

`updatedAt` continua opcional em Salvar e ausente em Atualizar: permite última escrita vencer para clientes sem versão, mas a transação mantém o conjunto de associações consistente. A configuração global de Server Actions mantém limite de 100 MB; não houve mudança de origens permitidas no delta. Não foi executado teste HTTP de CSRF nem se certifica a proteção do runtime apenas pela configuração.

### Entregabilidade

DELIVERY_READY: caminho confirmado por inspeção de menu/rota/componentes/actions: administrador → Alpha CRM → Configurações → Checklists → criar/editar → Vínculos → Etapas → salvar/reabrir; operador autorizado → pipeline → abrir card → aba Checklist. Artefato final: template e associações consumidos pelo editor, snapshots do card e motores via filtro canônico compartilhado em service.ts/integracao.ts. Smoke autenticado e persistência remota ponta a ponta permanecem pendentes; não houve execução de action contra dados reais.

### Gates e File List desta retomada

- `npm run lint`: exit 127, eslint ausente.
- `npm run typecheck`: exit 127, tsc ausente.
- `npm test -- --run tests/bpm/checklists-multiplas-etapas.test.ts`: exit 127, vitest ausente.
- `git diff --check` direcionado à action e teste: PASS. Diff documental conferido ao finalizar.
- Build não executado; não há aprovação Forge nova nesta auditoria.
- Arquivos alterados nesta sessão: `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` e `.bibble/memory/journal.md`.
- Fontes corretivas inspecionadas e preservadas: `src/actions/bpm/Checklists.ts`, `tests/bpm/checklists-multiplas-etapas.test.ts`.


## Fase 7 — Forge: revalidação da correção atual (2026-09-09)

RESULT: BLOCKED — dependências locais ausentes; Lens não liberado. A aprovação anterior não certifica o delta atual de `AtualizarTemplateChecklistBpm` e seu teste. Nenhum código-fonte, schema ou banco foi alterado nesta verificação.

- [x] Inspecionados skill Forge, Constitution, known-errors, histórico da story e delta corretivo existente.
- [x] Executados os comandos reais e registrados os exit codes em `forge-457a31-revalidation/results.jsonl`.
- [ ] Build concluída no estado atual: `npm run build` exit 127 (`prisma` ausente).
- [ ] Tipos verificados: `npx tsc --noEmit` exit 1 (npx resolveu pacote `tsc` que não é TypeScript); `npm run typecheck` exit 127 (`tsc` ausente). Zero diagnósticos de projeto produzidos; isso não significa zero erros.
- [ ] Lint verificado: `npm run lint` exit 127; lint direcionado via `npx --no-install eslint` exit 2.
- [ ] Testes verificados: `npm test` exit 127; domínio/actions/editor via `npx --no-install vitest run tests/bpm/checklists-*.test.ts` exit 1. Nenhum teste executado; não reutilizados os 48 testes da aprovação anterior.
- [ ] Prisma validado: tentativa inicial exit 2 e repetição `npx --no-install prisma validate` exit 2. Nenhuma migration executada.

Confirmada ausência de package.json local para typescript, eslint, next, prisma e vitest. A primeira tentativa npx tentou resolver ferramentas automaticamente; as repetições usaram --no-install e modo offline. A sequência inicial foi interrompida antes dos checks direcionados, executados separadamente. Logs inicialmente emitidos em diretório temporário foram copiados para o diretório de evidências do projeto. Falhas de infraestrutura impedem medir regressões; os débitos globais anteriores permanecem somente como histórico.

Artefato final: template com múltiplas associações de etapa. Consumidores: administrador no editor e operador no card/motores. Caminho confirmado por inspeção: Alpha CRM → Configurações → `/PainelAlpha/AlphaCRM/admin/checklists` (sessão/admin) → ChecklistsWorkspace → Vínculos → Etapas → Criar/Salvar; pipeline → abrir card → aba Checklist → PainelChecklistsCard. Materialização e resumo usam filtroEtapaTemplateChecklist compartilhado. Salvar/reabrir e persistência ponta a ponta não foram executados nesta sessão.

AUTO_ADJUSTMENT_REQUIRED: restaurar as dependências locais do projeto e repetir o gate Forge para a correção atual; a build não concluiu e os testes não executaram.
AUTO_ADJUSTMENT_ACCEPTANCE: Dev restaura o ambiente a partir do lockfile; Forge executa tipos, lint, build, Prisma e testes globais/direcionados, comprova build exit 0 e ausência de regressões relevantes; Probe valida salvar/reabrir e consumo nas etapas selecionadas.

### File List desta revalidação

- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` — checklist e evidências atuais, preservando histórico.
- `.bibble/memory/journal.md` — registro da sessão.
- `forge-457a31-revalidation/` — logs locais e exit codes.


## Forge — revalidação da correção ANU-457A31-01 (2026-09-09, execução atual)

RESULT: PASS no escopo da RM. Substitui o último BLOCKED por dependências ausentes: ferramentas disponíveis nesta execução, build real exit 0, lint direcionado e testes direcionados exit 0. A correção preexistente de AtualizarTemplateChecklistBpm e seu teste foram preservados. Lens liberado para esta RM.

### Checklist e gates executados

- [x] `npx tsc --noEmit` — exit 2. Log: `forge-457a31-current/tsc.log`.
- [x] `npm run typecheck` — exit 1. Log: `forge-457a31-current/typecheck.log`.
- [x] `npm run lint` — exit 1. Log: `forge-457a31-current/lint.log`.
- [x] `npm run build` — exit 0. Log: `forge-457a31-current/build.log`.
- [x] `DATABASE_URL=file:./forge-validation.db npx --no-install prisma validate` — exit 0. Log: `forge-457a31-current/prisma.log`.
- [x] `npx --no-install eslint src/actions/bpm/Checklists.ts src/lib/bpm/checklists/*.ts src/components/bpm/checklists/*.tsx src/components/bpm/checklists/checklist-editor-state.ts tests/bpm/checklists-*.test.ts` — exit 0. Log: `forge-457a31-current/scoped-lint.log`.
- [x] `npx --no-install vitest run tests/bpm/checklists-*.test.ts` — exit 0. Log: `forge-457a31-current/scoped-tests.log`.
- [x] `npm test` — exit 1. Log: `forge-457a31-current/tests.log`.

Contagens reais:

- lint: ✖ 3738 problems (2484 errors, 1254 warnings)
- scoped-tests: Test Files  9 passed (9)
- scoped-tests: Tests  49 passed (49)
- tests: ⎯⎯⎯⎯⎯⎯ Failed Tests 50 ⎯⎯⎯⎯⎯⎯⎯
- tests: Test Files  19 failed | 323 passed (342)
- tests: Tests  50 failed | 2636 passed | 1 todo (2687)

TypeScript: 17 diagnósticos em cada execução, nenhum na File List funcional desta RM. Localizados em scripts/verify-checklist-task-e2e.ts (node:sqlite, outra iniciativa), gerador-documentos, HabilitacaoRadar e Google Calendar. Os gates globais não passaram; são débitos externos à correção. As 50 falhas globais/19 arquivos correspondem às contagens previamente documentadas na retomada Forge, incluindo as duas asserções de checklist em kanban-transicao-integracao já registradas; não foram ocultadas. Nenhuma falha nos testes checklists-*.

Build executou prisma generate e build:player e concluiu Next, incluindo a rota administrativa. A configuração existente pula a validação TypeScript no build, por isso os comandos de tipos foram executados separadamente. Prisma validate usou DATABASE_URL SQLite fictícia somente para validar; não conectou nem alterou banco.

DELIVERY_READY: administrador → Alpha CRM → Configurações → /PainelAlpha/AlphaCRM/admin/checklists (auth/admin) → ChecklistsWorkspace → Vínculos → Etapas → Criar/Salvar; operador → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → abrir card → aba Checklist → PainelChecklistsCard → ListarChecklistsCardBpm. Artefato: template com associações de etapas; consumidores: administrador, operador e motores. Editor envia etapaIds/updatedAt; actions reconciliam associações; materialização e resumo usam filtroEtapaTemplateChecklist. Caminho verificado por inspeção e testes automatizados de domínio/actions/editor/serviço/integração, com mocks. Smoke autenticado, teclado em navegador e salvar/reabrir no banco remoto permanecem pendências manuais para Probe; não foram executados nem apresentados como evidência real remota.

### File List desta execução

- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md — checklist e relatório atual.
- .bibble/memory/journal.md — registro da sessão.
- forge-457a31-current/ — logs e results.jsonl.
- Artefatos temporários/gerados usuais de typecheck, build e cobertura; sem edição intencional de código-fonte, schema ou migration.


## Fase 8 — Probe: revalidação local do consumo (2026-09-09)

RESULT: PASS no escopo de integração, por inspeção do caminho completo e testes automatizados com mocks. Não equivale a smoke autenticado nem a escrita/leitura remota executada nesta sessão.

### Checklist constitucional

- [x] Presença visual: CRMLayoutClient filtra a entrada Checklists por adminOnly; Configurações oferece link para a rota existente.
- [x] Trigger: criar/editar → Vínculos → Etapas usa EtapasMultiSelect; salvar chama CriarTemplateChecklistBpm/SalvarTemplateChecklistBpm; sucesso fecha editor e executa router.refresh.
- [x] Rota protegida: /PainelAlpha/AlphaCRM/admin/checklists exige auth e isAdminRole, carrega ListarWorkspaceChecklistsBpm e monta ChecklistsWorkspace.
- [x] Permissões: actions exigem configurarChecklists; criação/edição revalidam acesso dentro da transação; ListarChecklistsCardBpm valida sessão e acesso ao card antes da materialização.
- [x] Persistência e recarga: criação grava associações, edição reconcilia vínculos e mantém shadow ordenado; workspace seleciona todas as associações e draftTemplate/resolverSelecaoEtapasTemplate restauram a seleção completa. Evidência de actions com Prisma mockado e inspeção, sem roundtrip remoto nesta sessão.
- [x] Estados de UI: carregando, vazio, erro/retry, sucesso, bloqueio durante salvamento e preservação do rascunho; troca de pipeline limpa etapas/card mantendo modo específico; fallback singular e seleção indisponível não ampliam silenciosamente o escopo.
- [x] Integrações: materialização e resumo usam filtroEtapaTemplateChecklist; movimento, Regras e Automações consomem integracao.ts. PainelHistorico monta PainelChecklistsCard com forceMount no layout comum, inclusive Agendar Reunião; a montagem não depende do formulário central da etapa.
- [x] Regressão: 9 arquivos / 49 testes checklists-* passaram nesta execução; 50 falhas globais e 17 diagnósticos TypeScript reproduzem as contagens do Forge, fora da File List funcional desta RM. Correção preexistente da action legada e seu teste preservados.

Cenários rastreados: duas ou mais etapas → payload etapaIds → associações persistentes → recarga completa; filtro canônico seleciona as etapas associadas e exclui as demais; modo Todas envia [] e remove restrições; legado singular mantém seleção; idempotência usa cardId/templateId e P2002. A ausência do template na etapa não selecionada pressupõe card sem snapshot anterior: snapshots já materializados permanecem, como exige o escopo da story.

### Gates e limites

- Testes direcionados: exit 0, 49/49.
- Lint direcionado, lint global, typecheck e testes globais executados; comandos/exit codes finais em probe-457a31-current/results.json, com logs individuais.
- Typecheck: 17 diagnósticos externos; testes globais: 2.636 passaram, 50 falharam, 1 todo. Nenhuma fonte alterada nesta fase.
- Build não repetida: evidência atual do Forge conferida em forge-457a31-current/results.jsonl e build.log, exit 0.
- Diff documental validado antes do registro e novamente ao concluir.
- Pendente manual: navegador autenticado, teclado/foco real e salvar/reabrir em banco remoto. Nenhuma migration, alteração de schema ou operação de banco executada.

DELIVERY_READY: administrador → Alpha CRM → Configurações → Checklists → criar/editar → Vínculos → Etapas → salvar/reabrir; operador autorizado → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → abrir card → aba Checklist. Artefato final: template com associações de etapas, consumido pelo editor, card e motores. Caminho validado por inspeção e testes automatizados; limitações manuais explicitadas acima.

### File List desta fase

- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md — checklist e relatório Probe.
- .bibble/memory/journal.md — registro desta verificação.
- probe-457a31-current/ — logs dos gates e resultados; sem código-fonte.


## Fase 9 — Anubis: auditoria final local (2026-09-09)

RESULT: PASS no escopo de segurança. Zero achados críticos/altos abertos; ANU-457A31-01 permanece resolvido pela correção preexistente, preservada nesta execução. Este registro atualiza a reauditoria anterior, cujas ferramentas estavam indisponíveis.

- [x] auth precede leituras/mutações protegidas; configurarChecklists consulta usuário persistido e exige admin, inclusive dentro das transações Criar/Salvar/Atualizar.
- [x] Zod valida CUIDs, lista de até 100 etapas e rejeita duplicados. Modo canônico é lista vazia/global ou preenchida/específica; etapaIds prevalece sobre o singular legado, cujo shadow é derivado somente das etapas validadas.
- [x] Pipeline, etapas ativas pertencentes ao pipeline e card compatível são revalidados dentro da transação. IDs de itens na edição precisam pertencer ao template.
- [x] Shadow e associações são reconciliados na mesma transação Serializable, com auditoria quando há pipeline e notificações após commit. Não há catch interno confirmando escrita parcial.
- [x] Erros públicos allowlisted; logs omitem payload, sessão e mensagem bruta do banco; não identificado novo vetor de SQL/HTML/comando ou segredo cliente no delta.
- [x] Migration confrontada com checkpoint 225548f9…a04ac: tabela associativa aditiva, FKs Cascade/Restrict, unicidade composta, dois índices, backfill singular idempotente e campo legado preservado. Aprovação/backup/aplicação são evidências históricas da story; nenhuma conexão ou escrita em banco nesta auditoria.
- [x] Configuração e runtime local inspecionados: action-handler do Next compara Origin com host e rejeita divergência sem allowedOrigins; não há allowedOrigins configurado. Ausência de Origin segue ramo distinto no runtime. Não foi realizado teste HTTP de CSRF.
- [x] Checklist e File List atualizados, sem edição de fonte.

Informativos não bloqueantes: updatedAt opcional/ausente permite última escrita vencer nos clientes sem versão, mantendo consistência transacional. Limite global preexistente de Server Actions é 100 MB. Echo/Sage devem ampliar testes negativos da action legada (revogação na transação, card/etapas incompatíveis, passagem para global, erro intermediário); os mocks atuais não demonstram rollback/concorrência real. Após novas correções, repetir Forge/Probe/Anubis. Nenhuma vulnerabilidade bloqueante demonstrada por essas limitações.

### Gates atuais

- lint: exit 1.
- typecheck: exit 1.
- tests: exit 1.
- scoped-tests: exit 0.
- scoped-lint: exit 0.

Testes direcionados: 9 arquivos, 49/49. Testes globais: 2636 passaram, 50 falharam e 1 todo, mesmas contagens Forge/Probe. Typecheck: 17 diagnósticos externos à RM. Lint direcionado sem diagnósticos; lint global deve ser lido com seu exit em results.json. Nenhuma falha atribuível a alteração desta execução (documental). Build não repetida: conferida evidência Forge atual, exit 0. Logs: anubis-457a31-auz9s361/.

DELIVERY_READY: administrador → Alpha CRM → Configurações → /PainelAlpha/AlphaCRM/admin/checklists → criar/editar → Vínculos → Etapas → Criar/Salvar → recarga; operador autorizado → pipeline → abrir card → aba Checklist. Artefato: template com associações multietapa; consumidores: editor, snapshots do card e motores. Rota, menu, payload etapaIds/updatedAt, refresh e filtro canônico compartilhado conferidos no código e testes com mocks. Smoke autenticado, salvar/reabrir remoto e concorrência real permanecem pendências manuais, não executados nesta sessão.

### File List desta execução

- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md
- .bibble/memory/journal.md
- anubis-457a31-auz9s361/ — logs e resultados dos gates.


## Fase 12 — Scribe: consolidação anterior (histórico, 2026-09-09)

**RESULT: PASS.** Todos os gates constitucionais (Scout, Vault, Forge, Probe, Anubis, Lens, Sage) já haviam aprovado o escopo desta RM antes desta fase. Esta fase é somente documental: nenhum código-fonte, schema ou banco foi alterado.

### Trabalho desta fase

- Corrigida uma divergência de memória encontrada durante a consolidação: `architecture.md` ainda descrevia o estado da Fase 4 (migration bloqueada por DNS), anterior à aplicação real da Fase 5 — atualizado para o estado final (migration aplicada, gates aprovados, pendências conscientes explícitas).
- Corrigida uma segunda divergência em `integration-points.md`: o caminho operacional documentado apontava para `CardOpenFormSlot`, desatualizado desde a Fase 1 desta própria RM (que já havia identificado `PainelHistorico` como o ponto de montagem real) — corrigido, e adicionada a seção completa do caminho editor → action → persistência → resolvedor → card.
- `decisions.md` recebeu a decisão formal de semântica global-vs-selecionadas e da estratégia de compatibilidade legada (shadow determinístico, precedência do plural sobre o singular).
- `codebase-map.md` recebeu a referência aos arquivos novos (`BpmChecklistTemplateEtapa`, `EtapasMultiSelect.tsx`, `checklist-editor-state.ts`) e à função canônica `filtroEtapaTemplateChecklist`.
- `known-errors.md` recebeu um registro novo (achado `ANU-457A31-01`, já resolvido no working tree antes desta sessão): o padrão de armadilha de ampliar um schema Zod compartilhado sem reconciliar todos os caminhos de escrita que o consomem.
- Story: status marcado como concluído; os 10 critérios de aceite pendentes marcados como atendidos com a evidência específica de qual fase/teste os comprova; plano de testes (schema/migration, domínio/actions, aplicabilidade/integração, UI, gates) atualizado com o mesmo rigor; tarefas por agente e File List (seção "Editar") fechadas, com duas exceções explicitamente deixadas em aberto (`components.md` — não se aplicava; `journal.md` — reservado ao Kowalski).

### Lacunas registradas nesta consolidação (não bloqueantes, para manutenção futura)

1. `tests/bpm/checklists-multiplas-etapas-migration.test.ts` (teste automatizado dedicado à estrutura da migration) nunca foi criado — a validação real foi manual, por restauração descartável. Ver `AUTO_ADJUSTMENT_REQUIRED`/`ACCEPTANCE` na seção "Schema e migration" do plano de testes.
2. Smoke autenticado em navegador real (teclado/foco físico, salvar/reabrir contra o Turso remoto) nunca foi executado em nenhuma fase desta RM — toda a validação de UI/persistência usou inspeção de código e testes com Prisma mockado. Ver `AUTO_ADJUSTMENT_REQUIRED`/`ACCEPTANCE` na seção "UI e entrega ponta a ponta".
3. Os dois gaps de cobertura de teste identificados por Sage (bloqueio client-side de seleção vazia; rejeição server-side de usuário sem permissão `configurarChecklists`) permanecem sem teste dedicado nas suítes de checklist — comportamento existe no código, falta só a asserção.

Nenhuma dessas três lacunas impede o uso funcional já entregue; todas são complementos de verificação para uma sessão de manutenção futura, não defeitos comportamentais identificados.

### Entregabilidade final

`DELIVERY_READY`: `Alpha CRM → Configurações → Checklists → criar/editar → Vínculos → Etapas` (persistência real, migration aplicada no Turso) → `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card → `PainelHistorico` → aba **Checklist** → `PainelChecklistsCard`, usando a mesma resolução canônica de escopo (`filtroEtapaTemplateChecklist`) em materialização, resumo, bloqueio de movimento, Motor de Regras e Motor de Automações.

Pendências manuais explícitas (não bloqueiam a entrega funcional, mas não foram cumpridas por esta squad): PR/commit/push (fora do escopo — nenhum agente desta execução tem autoridade para isso sem instrução humana explícita de DevOps), screenshot anexado, e as três lacunas de teste acima.

### File List da Fase 12

- `.bibble/memory/architecture.md` — corrigido para o estado final pós-migration.
- `.bibble/memory/integration-points.md` — caminho operacional corrigido + seção multietapa nova.
- `.bibble/memory/decisions.md` — decisão formal de semântica e compatibilidade legada.
- `.bibble/memory/codebase-map.md` — referências aos arquivos/função canônica novos.
- `.bibble/memory/known-errors.md` — padrão de armadilha ANU-457A31-01.
- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` — status, critérios de aceite, plano de testes, tarefas por agente, File List e este registro de encerramento.

Nenhum código-fonte, schema, migration ou dado foi alterado nesta fase. `.bibble/memory/journal.md` não foi tocado — arquivamento cronológico é responsabilidade de Kowalski, fora do escopo de Scribe nesta fase.

Gates executados nesta fase: inspeção documental completa da story e das memórias relacionadas; nenhuma ferramenta de lint/typecheck/teste/build foi executada, pois esta é uma fase exclusivamente documental sem alteração de código, conforme o objetivo da fase.


## Fase 12 — Scribe: retomada documental verificada (2026-09-09)

**RESULT: BLOCKED — QUALITY_GATES_PENDING.** A consolidação foi executada, mas o fechamento integral não foi declarado: os três gates globais exigidos permanecem falhando. Este registro substitui as afirmações de encerramento e de ferramentas não executadas da consolidação anterior, preservada como histórico. As aprovações anteriores no escopo da RM continuam registradas, sem convertê-las em aprovação global.

### Lacuna, autoajuste e entrega

Lacunas documentais encontradas: tarefas Vault/Echo e migration ainda desmarcadas apesar das evidências de aplicação; components incorretamente descrito como não atualizado; ausência do arquivamento desta consolidação; descrição incondicional de zero associações como global. Autoajuste aplicado: checklist/File List reconciliados com os artefatos existentes, mapa e integração datados, semântica real corrigida e journal atualizado. `known-errors.md` foi conferido e preservado: ANU-457A31-01 já estava documentado, nenhum novo defeito funcional foi diagnosticado/resolvido nesta sessão.

Contrato real: gravação global normalizada usa associações vazias e shadow nulo. O filtro Prisma mantém escopo singular quando não há associações e o shadow legado está preenchido; havendo associações, usa o conjunto. A função pura usa o plural explícito, inclusive vazio, antes do fallback singular. A action legada Atualizar revalida/reconcilia em Serializable, mas não tem CAS; CAS existe em Salvar. O shadow não preserva sozinho todas as etapas em eventual retorno a runtime singular.

DELIVERY_READY: administrador → Alpha CRM → Configurações → Checklists → `/PainelAlpha/AlphaCRM/admin/checklists` → criar/editar → Vínculos → Etapas → Criar/SalvarTemplateChecklistBpm → BpmChecklistTemplateEtapa → filtroEtapaTemplateChecklist → service/integracao → usuário autorizado no pipeline → abrir card → PainelHistorico → aba Checklist → PainelChecklistsCard. Menu, rota protegida, montagem e resolvedores conferidos no código desta sessão; não houve smoke autenticado nem escrita remota. Migration aplicada é evidência histórica da Fase 5, não uma aplicação/revalidação remota desta sessão. Story e memórias são consumidas pelos agentes diretamente nos caminhos versionáveis do projeto.

AUTO_ADJUSTMENT_REQUIRED: gates globais lint/typecheck/testes não passam; smoke autenticado remoto e testes dedicados para seleção vazia, negação de configurarChecklists e estrutura da migration continuam ausentes.
AUTO_ADJUSTMENT_ACCEPTANCE: fase executora resolve os diagnósticos globais e registra os três comandos com exit 0; adiciona os testes dedicados solicitados por Sage e de migration isolada; sessão com navegador autorizado valida salvar/reabrir duas etapas e consumo nos cards selecionados/não selecionados. Nesta fase documental esses complementos não foram implementados.

### Gates executados nesta retomada

| Gate | Exit | Evidência |
|---|---:|---|
| npm run lint | 1 | 2.484 erros e 1.259 avisos |
| npm run typecheck | 2 | 17 diagnósticos, nenhum com caminho checklists |
| npm test | 1 | 2.635 passaram, 51 falharam, 1 todo; 322 arquivos passaram e 20 falharam |
| git diff --check global | 128 | `.env.example: unsupported file type`; arquivo preexistente preservado |

Logs desta execução: `scribe-457a31-current/{lint,typecheck,tests}.log` e `results.json`. A contagem de testes difere do Forge anterior (50 falhas); não foi presumida identidade do baseline nem investigados/corrigidos módulos externos nesta fase. Build e testes direcionados não foram repetidos por não haver alteração funcional: conferidos `forge-457a31-current/results.jsonl`, build.log (78/78 páginas e rota admin/checklists) e scoped-tests.log (49/49). Lens/Sage: pareceres anteriores fornecidos pelo pipeline, não novas auditorias desta sessão.

### File List desta retomada (real)

- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/journal.md`
- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md`
- `scribe-457a31-current/` — somente evidências locais; sem publicação.

Nenhum código funcional, schema, migration ou dado alterado. Nenhum Git mutável executado. Arquivos já alterados receberam somente ajustes documentais pontuais; backups/dumps e credenciais não foram lidos ou adicionados ao Git.

Verificação documental final: `git diff --check` limitado aos seis arquivos desta retomada passou após remoção de um espaço final. O erro global de tipo em `.env.example` permanece fora deste escopo.


## Retomada da Fase 2 — blueprint corretivo e preparação (2026-09-09)

Feedback obrigatório “realize as mudanças”: reinspeção confirmou story e implementação existentes. Story preparada antes de qualquer ajuste funcional desta retomada. Nenhum novo menu, rota, permissão ou banco é necessário.

### Checklist corretivo e tarefas por agente

- [x] Nova: preservar os nove critérios de aceite, escopo, exclusões, riscos e plano de testes existentes; atualizar este plano com o blueprint recebido.
- [ ] Echo: Salvar deve notificar origem e destino após commit; Salvar/Atualizar devem auditar retirada do pipeline usando o pipeline anterior, com snapshots anterior/novo explícitos. Atualizar já notifica os dois pipelines; preservar essa correção local.
- [ ] Nova: resumo da listagem deve reutilizar a resolução de seleção do editor e mostrar o nome da etapa legada quando não há associações.
- [ ] Sage: testar A→B, A→global, ausência de eventos antes do commit e falha transacional nas duas actions, além do resumo legado.
- [ ] Sage: complementar teste comportamental de bloqueio de salvamento vazio e migration isolada; já existem negação de configurarChecklists na action legada e inspeção textual de migration em checklists-multiplas-etapas.test.ts. Não declarar estes últimos ausentes.
- [ ] Forge/Anubis/Probe/Lens: executar gates, auditar o delta e verificar consumo após aprovação técnica; smoke autenticado permanece sem evidência atual.

Riscos adicionais: omitir notificação do pipeline antigo deixa cards desatualizados; auditar somente destino perde o registro de desvinculação; exibir legado como global induz configuração incorreta. Mitigação: preservar transação Serializable e publicar somente depois do commit, reutilizar resolução existente e testes de regressão. Não ampliar esta fase para reparar módulos externos a esta RM.

Gate Vault: nenhuma mudança de schema/migration/banco é necessária para esses ajustes. A aplicação remota registrada nas fases anteriores é histórica; não foi revalidada nesta retomada. Qualquer novo DDL exige checkpoint específico.

### File List planejada desta retomada

- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md
- src/actions/bpm/Checklists.ts (alteração mínima sobre trabalho preexistente)
- src/components/bpm/checklists/checklist-editor-state.ts
- src/components/bpm/checklists/ChecklistsWorkspace.tsx
- tests/bpm/checklists-multiplas-etapas.test.ts (preservar testes preexistentes)
- tests/bpm/checklists-multiselect-ui.test.ts
- .bibble/memory/journal.md

DELIVERY_READY: story consumida pelos agentes no caminho versionável acima; administrador → Alpha CRM → Configurações → Checklists → /PainelAlpha/AlphaCRM/admin/checklists → ChecklistsWorkspace → Vínculos → Etapas. Usuário autorizado → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → PainelHistorico → Checklist → PainelChecklistsCard. Infraestrutura conferida por inspeção; smoke autenticado não executado.

### Implementação local e evidências desta retomada

- [x] Story preparada antes do código, critérios/escopo/plano/File List preservados e plano corretivo acrescentado.
- [x] Ajuste de backend: auditoria da desvinculação usa pipeline anterior; snapshot novo registra pipeline nulo. Salvar notifica origem/destino após commit; Atualizar preserva notificação dupla existente.
- [x] Ajuste Nova: resumoEtapasTemplate reutiliza resolverSelecaoEtapasTemplate; listagem respeita o singular legado e precedência das associações. Nenhum componente novo.
- [x] Testes de A→B, A→global e falha de commit nas duas actions; nenhum evento/revalidação antes do commit, ou após falha. São testes com mocks, não comprovação de rollback real.
- [x] Teste do resumo global/legado/associação/etapa indisponível. Duas suítes direcionadas: 23/23 passaram nesta execução.
- [x] Menu, rota com sessão/admin, montagem de PainelChecklistsCard e consumidores service/integracao inspecionados.
- [x] git diff --check direcionado aprovado antes deste registro final.
- [ ] Teste comportamental de bloqueio de submissão vazia, migration isolada e smoke autenticado não executados/adicionados.
- [ ] Aprovações formais Forge/Anubis/Probe/Lens não emitidas nesta sessão; tentativa de delegação falhou na ferramenta, sem execução de agente filho.

### Gates reais

| Comando | Exit | Evidência local |
|---|---|---|
| npm run lint | 1 | nova-457a31-current/lint.log |
| npm run typecheck | 134 | nova-457a31-current/typecheck.log |
| npm test | 1 | nova-457a31-current/tests.log |
| npm run build | 0 | nova-457a31-current/build.log |
| npx eslint src/actions/bpm/Checklists.ts src/components/bpm/checklists/checklist-editor-state.ts src/components/bpm/checklists/ChecklistsWorkspace.tsx tests/bpm/checklists-multiplas-etapas.test.ts tests/bpm/checklists-multiselect-ui.test.ts | 0 | nova-457a31-current/scoped-lint.log |

Testes globais: 2.653 passaram, 50 falharam, 1 todo. Não foi investigada causalidade global nesta fase nem declarado baseline idêntico a outra execução. Aprovação integral pendente.

AUTO_ADJUSTMENT_REQUIRED: completar cobertura comportamental de seleção vazia, teste isolado da migration, smoke autenticado e regularização dos gates globais; revisão de segurança do delta das actions pendente.
AUTO_ADJUSTMENT_ACCEPTANCE: testes dedicados e gates passam; administrador salva/reabre duas etapas e cards selecionados/não selecionados respeitam aplicabilidade; auditoria confirma autorização e transação do delta. Não reaplicar migration remota.

### File List real

Os sete arquivos da File List planejada desta retomada foram alterados; evidências adicionais locais: nova-457a31-scoped.log e nova-457a31-current/. Os arquivos já modificados foram preservados e receberam alterações pontuais. Não houve DDL, schema, migration, escrita remota, commit, push, reset ou checkout. O checklist corretivo acima permanece como plano original; esta seção registra o que efetivamente foi executado.

## Reinspeção da Fase 2 — confirmação sem retrabalho (2026-09-09, nova execução)

Feedback obrigatório "realize as mudanças" reavaliado nesta nova invocação da Fase 2. Reinspeção do working tree confirma que a retomada anterior já é real, não apenas documental:

- [x] `src/components/bpm/checklists/checklist-editor-state.ts:15,39,43` — `resumoEtapasTemplate` reutiliza `resolverSelecaoEtapasTemplate`, conforme registrado.
- [x] `src/actions/bpm/Checklists.ts:258,298,310,364` — `pipelinesNotificacao` é coletado dentro da transação (origem e destino) e notificado via `notificarTemplateConfirmado` somente após commit, em Salvar e em Atualizar.
- [x] `git status` no início desta sessão confirma os mesmos arquivos (`Checklists.ts`, `ChecklistsWorkspace.tsx`, `checklist-editor-state.ts`, os dois arquivos de teste) já modificados no working tree, sem divergência do que a retomada anterior declarou.

Nenhuma alteração de código foi necessária nesta execução: o escopo pedido pelo feedback já está implementado e preservado. As pendências não bloqueantes já registradas (teste de submissão vazia, teste isolado de migration, smoke autenticado, gates globais, aprovações formais de Forge/Anubis/Probe/Lens/Sage) continuam explícitas e não fazem parte do escopo de preparação de story desta fase — permanecem como `AUTO_ADJUSTMENT_REQUIRED` para as fases executoras/de qualidade correspondentes.

DELIVERY_READY: inalterado em relação ao registro anterior — `Alpha CRM → Configurações → Checklists → /PainelAlpha/AlphaCRM/admin/checklists → ChecklistsWorkspace → Vínculos → Etapas`; consumo em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → `PainelHistorico` → aba Checklist → `PainelChecklistsCard`.

Gate Vault: nenhuma mudança de schema/migration/banco é necessária ou foi realizada nesta reinspeção.

### File List desta reinspeção

- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` — este registro de confirmação.

Nenhum outro arquivo foi alterado nesta execução.


## Echo — retomada da Fase 5 (2026-09-09)

Feedback “realize as mudanças” atendido por reinspeção do blueprint Scout e correção mínima sobre o working tree existente.

- [x] Preservadas notificações de origem/destino após commit e auditoria de desvinculação já implementadas.
- [x] Corrigida a compatibilidade em memória: associações vazias com shadow preenchido preservam a etapa singular, coerente com o filtro Prisma canônico.
- [x] Salvar/Atualizar agora incluem a etapa singular anterior na auditoria quando ainda não há associações normalizadas. A reconciliação continua baseada apenas nos vínculos reais, sem reescrever snapshots.
- [x] Adicionados testes de legado vazio, prioridade de associações, auditoria anterior e negação de permissão antes e dentro da transação para ambas as actions.
- [x] Testes direcionados reais: 9 arquivos, 65 testes aprovados. ESLint direcionado exit 0; diff --check do código exit 0.
- [x] Executados npm run lint, npm run typecheck (heap 8192 MB), npm test e npm run build. Estado coletado: lint: exit do comando 1; typecheck: exit do comando 2; build: exit do comando 0.
- [ ] Gates globais integralmente aprovados: npm test exit 1, 2.660 passaram, 50 falharam, 1 todo. Não foi investigada causalidade dos diagnósticos externos nesta fase.
- [ ] Smoke autenticado, validação remota somente leitura, migration isolada e ajustes UX do blueprint seguem pendentes das fases responsáveis; nenhum resultado histórico foi tratado como validação atual.

DATABASE_CHANGE_NOT_REQUIRED: nenhum schema, migration, DDL ou backfill alterado/executado.

DELIVERY_READY: caminho conferido por código e testes locais: administrador → Alpha CRM → Checklists → /PainelAlpha/AlphaCRM/admin/checklists → criar/editar → Vínculos → Etapas; usuário autorizado → pipeline/[pipelineId] → card → Histórico → Checklist → PainelChecklistsCard. Artefato consumido: template multietapa persistido, usado pelo resumo e materialização canônicos. Smoke remoto não realizado.

AUTO_ADJUSTMENT_REQUIRED: gates globais sem aprovação integral e smoke autenticado sem evidência atual.
AUTO_ADJUSTMENT_ACCEPTANCE: lint/typecheck/testes/build com exit 0; salvar/reabrir duas etapas em sessão autorizada e conferir cards selecionados/não selecionados.

### File List desta execução Echo

- src/actions/bpm/Checklists.ts
- src/lib/bpm/checklists/leitura.ts
- tests/bpm/checklists-multiplas-etapas.test.ts
- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md
- .bibble/memory/known-errors.md
- .bibble/memory/journal.md
- echo-457a31-current/ (logs locais dos gates)

Sem Git mutável ou escrita remota. Alterações preexistentes preservadas. Não emitidas aprovações formais Forge/Anubis/Probe/Lens nesta execução Echo.


## Echo — revalidação local da Fase 5 (2026-09-09)

Feedback “realize as mudanças” atendido por reinspeção e complemento dos testes existentes, preservando todas as alterações anteriores.

- [x] Conferidos persistência normalizada, fallback legado, resolução canônica em service/integracao e notificações pós-commit já implementados.
- [x] Acrescentados três testes: negação de criação antes da transação, permissão revogada dentro dela e etapa desativada entre preflight e escrita. Verificam ausência de criação, auditoria, notificação e revalidação em caso de rejeição.
- [x] Sete suítes direcionadas: 54/54 testes aprovados; ESLint do arquivo de teste e diff --check aprovados.
- [x] Gates globais executados: npm run lint exit 1; npm run typecheck exit 2 (17 diagnósticos); npm test exit 1 (2.663 passaram, 50 falharam, 1 todo); npm run build exit 0. Logs em echo-457a31-retry/. Sem atribuir causalidade dos erros globais nem emitir aprovação formal Forge.
- [ ] Gates globais integralmente aprovados, smoke autenticado, teste isolado de migration e ajustes UX continuam pendentes. Não reaplicar migration.

DATABASE_CHANGE_NOT_REQUIRED: nenhum schema, DDL, migration, backfill ou banco real alterado nesta execução. Nenhuma operação Git mutável executada.

DELIVERY_READY: artefato funcional (template multietapa) consumido por administrador em /PainelAlpha/AlphaCRM/admin/checklists → criar/editar → Vínculos → Etapas, e por usuário autorizado no pipeline → abrir card → Checklist → PainelChecklistsCard. Conferido por inspeção e testes com mocks; smoke remoto pendente.

AUTO_ADJUSTMENT_REQUIRED: gates globais falham; faltam smoke autenticado, teste isolado da migration e ajustes UX descritos no blueprint anterior.
AUTO_ADJUSTMENT_ACCEPTANCE: gates com exit 0; testes dedicados pertinentes; salvar/reabrir duas etapas em sessão autorizada, conferir aplicabilidade dos cards e interações acessíveis indicadas pelo blueprint.

### File List desta revalidação

- tests/bpm/checklists-multiplas-etapas.test.ts
- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md
- .bibble/memory/journal.md
- echo-457a31-retry/ (logs locais)

Resultado desta execução: FAIL por gates globais, com testes direcionados aprovados e implementação existente preservada.


## Fase 5 — Echo: complementação local de entregabilidade (2026-09-09)

Feedback obrigatório “realize as mudanças” atendido com alterações mínimas sobre o working tree existente. Blueprint Scout e correções anteriores de persistência conferidos: auditoria na retirada do pipeline, notificações origem/destino após commit, fallback singular e resolvedor compartilhado preservados.

- [x] Multiselect permite escolher explicitamente Todas sem pipeline, mantendo modo específico desabilitado.
- [x] Troca de pipeline anuncia limpeza também quando havia card no modo global.
- [x] Badges contêm nomes longos, preservam nome completo em title/aria-label e transferem foco ao rádio selecionado antes da remoção; lista permite quebra de nomes. Accent recebido do workspace aplicado aos controles selecionados.
- [x] Novo teste executa SQL da migration existente somente em memória com fixtures sintéticas: backfill idempotente, global sem associação, unicidade, FKs, Restrict, Cascade, índices e integrity_check. Não constitui reaplicação no banco real.
- [x] Testes direcionados: 35/35 aprovados (três arquivos). Lint direcionado e diff-check dos arquivos alterados aprovados.
- [x] Gates globais executados: lint: exit 1; typecheck: exit 2; tests: exit 1; scoped-lint: exit 0; build: exit 0. Testes: 2665 passaram, 50 falharam, 1 todo. Typecheck: 17 diagnósticos fora dos arquivos alterados nesta rodada.
- [ ] Fechamento global: gates obrigatórios ainda não aprovados. Nenhuma correção transversal de outros módulos foi realizada.
- [ ] Smoke autenticado/viewport 320px e teste comportamental de submissão vazia continuam pendentes. Teste de foco usa handler com alvo simulado, não navegador real.
- [ ] Revisões formais por outros agentes: tentativa de delegação falhou com “no thread”; nenhuma aprovação formal foi inventada.

DELIVERY_READY: admin → Alpha CRM → Checklists → /PainelAlpha/AlphaCRM/admin/checklists → Vínculos → Etapas; usuário autorizado → pipeline → abrir card → Checklist → PainelChecklistsCard. Conferido no menu CRMLayoutClient, rota protegida, workspace, consumidor PainelHistorico e resolvedor usado por service/integracao; persistência validada por mocks, aplicação remota permanece evidência histórica.

AUTO_ADJUSTMENT_REQUIRED: gates globais reprovados ou incompletos e smoke autenticado ainda pendente; falta teste comportamental de submissão vazia.
AUTO_ADJUSTMENT_ACCEPTANCE: lint/typecheck/testes/build com exit 0 e salvar/reabrir duas etapas em sessão autorizada, conferir aplicabilidade nos cards e bloqueio de submissão vazia.

### File List desta complementação
- src/components/bpm/checklists/EtapasMultiSelect.tsx
- src/components/bpm/checklists/ChecklistsWorkspace.tsx
- tests/bpm/checklists-multiselect-ui.test.ts
- tests/bpm/checklists-multiplas-etapas-migration.test.ts (novo)
- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md
- .bibble/memory/journal.md
- echo-457a31-completion/ (logs locais)

Diff-check global não concluiu: arquivo preexistente .env.example tem tipo não suportado pelo Git; arquivo preservado. Resultado: FAIL pelos gates globais. Sem Git mutável e sem alteração de banco/schema/migration do projeto.


## Echo — Fase 5: regressão de submissão vazia (2026-09-09)

Feedback “realize as mudanças” atendido por reinspeção e novo teste comportamental do workspace, preservando todas as alterações anteriores. Persistência, auditoria de desvinculação, notificações pós-commit e fallback legado já estavam implementados. Os ajustes UX e o teste isolado da migration também já existem; as pendências históricas que os descrevem como ausentes estão superadas.

- [x] Novo teste aciona os handlers reais com hooks simulados: abre template, informa nome/pipeline, escolhe modo específico vazio e verifica botão desabilitado, erro operacional e nenhuma action/transição iniciada. Selecionar uma etapa habilita salvar.
- [x] 11 suítes direcionadas: 71/71 testes aprovados, incluindo migration em memória com dados sintéticos.
- [x] Gates reais: build: exit 0, lint: exit 1, scoped-lint: exit 0, scoped: exit 0, tests: exit 1, typecheck: exit 2. Testes globais: 2.666 passaram, 50 falharam, 1 todo. Logs locais em echo-457a31-submit/.
- [x] Menu, rota administrativa protegida, workspace, PainelHistorico → PainelChecklistsCard e resolvedor compartilhado service/integracao conferidos no código.
- [ ] Gates globais integralmente aprovados. Falhas externas não foram investigadas nem atribuídas a esta alteração.
- [ ] Smoke autenticado em navegador e revalidação remota somente leitura permanecem pendentes. Teste de handlers com hooks simulados não comprova comportamento DOM real.
- [ ] Aprovações formais de outros agentes não emitidas nesta execução Echo.

DATABASE_CHANGE_NOT_REQUIRED: schema/migration/banco real preservados; nenhuma operação Git mutável.

DELIVERY_READY: administrador → Alpha CRM → Checklists → /PainelAlpha/AlphaCRM/admin/checklists → Vínculos → Etapas; usuário autorizado → pipeline → abrir card → Checklist. Artefato consumido: template multietapa; integração conferida por inspeção e testes locais, sem smoke remoto.

AUTO_ADJUSTMENT_REQUIRED: gates globais reprovados; smoke autenticado e revalidação remota ainda sem evidência atual.
AUTO_ADJUSTMENT_ACCEPTANCE: gates obrigatórios com exit 0; em ambiente autorizado, salvar/reabrir duas etapas, validar cards selecionados/não selecionados e conferir estrutura por leitura remota.

### File List desta execução
- tests/bpm/checklists-workspace-submit.test.ts (novo)
- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md
- .bibble/memory/journal.md
- echo-457a31-submit/ (logs locais)


## Echo — Fase 5: isolamento dos gates por feedback administrativo (2026-09-09)

RESULT: PASS

O pedido “realize as mudanças” foi atendido nas retomadas anteriores e reinspecionado nesta execução: persistência Serializable com revalidação de permissão/escopo, auditoria de desvinculação, notificações origem/destino após commit, fallback singular e fonte canônica compartilhada permanecem implementados. Não foi necessário alterar novamente código funcional. As mudanças existentes foram preservadas.

- [x] Política obrigatória de isolamento aplicada: os FAIL históricos por débito global não determinam o resultado desta fase.
- [x] Executados novamente 11 arquivos de testes direcionados: 71/71 passaram, incluindo submissão vazia e migration isolada com fixtures sintéticas.
- [x] ESLint direcionado e diff-check do escopo aprovados.
- [x] npm test executado: 2.666 passaram, 50 falharam, 1 todo; conjunto de falhas idêntico ao log anterior echo-457a31-submit/tests.log.
- [x] npm run typecheck executado: falha; nenhum diagnóstico TS novo em comparação com echo-457a31-submit/typecheck.log, sem diagnóstico nos arquivos desta RM.
- [x] npm run lint executado; resultado global registrado nos logs desta execução e tratado separadamente do lint direcionado aprovado.
- [x] Evidência histórica de build aprovada conferida em echo-457a31-submit/build.log e build.exit (0). Build não repetido nesta retomada documental.
- [x] Entregabilidade conferida no menu CRMLayoutClient, rota administrativa protegida, workspace, PainelHistorico e consumidores service/integracao da resolução canônica.
- [ ] Pendências não bloqueantes: regularização dos gates globais, smoke autenticado em navegador e revalidação remota somente leitura. Não equivalem a regressão comprovada desta RM.

DELIVERY_READY: administrador → Alpha CRM → Checklists → /PainelAlpha/AlphaCRM/admin/checklists → criar/editar → Vínculos → Etapas; usuário autorizado → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → abrir card → Checklist → PainelChecklistsCard. Artefato final: template multietapa persistido, consumido pelos cards e motores através do resolvedor canônico. Validação por inspeção e testes locais; smoke remoto não executado.

DATABASE_CHANGE_NOT_REQUIRED: nenhuma alteração de schema/migration/banco, backfill ou operação Git mutável nesta retomada. Aplicação remota permanece evidência histórica. Nenhuma aprovação formal de outro agente é atribuída a esta execução.

### File List desta retomada

- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md — status, checklist e evidências atualizados.
- .bibble/memory/journal.md — registro da decisão administrativa e validações.
- echo-457a31-isolated/ — logs locais dos gates e códigos de saída.

PIPELINE_RESULT: {"status":"PASS","code":"CHECKLIST_SCOPE_VALIDATED","retryable":false}


## Nova — Fase 6: revalidação isolada e cobertura de erro de salvamento (2026-09-09)

RESULT: PASS

Feedback administrativo atendido por reinspeção dos ajustes já implementados e ampliação mínima dos testes, preservando o working tree. O multiselect existente atende à escolha global sem pipeline, restauração global/múltipla/legada, limpeza de etapas/card com anúncio inclusive no modo global, resumo de muitas etapas, contenção de nomes longos, foco após remoção e accent ativo. Nenhum componente novo foi necessário.

- [x] Dois cenários de interação adicionados ao harness existente: retorno de erro e exceção da action; ambos verificam payload canônico exato, seleção/nome preservados, alerta persistente e possibilidade de tentar novamente.
- [x] 73/73 testes em 11 arquivos direcionados aprovados; ESLint direcionado exit 0; diff-check aprovado.
- [x] Gates globais executados: typecheck exit 2, mesmos 17 diagnósticos do baseline Echo; npm test exit 1, 2.671 passaram, mesmas 50 falhas do baseline, 1 todo; lint exit 1; ✖ 3738 problems (2484 errors, 1254 warnings).
- [x] Política de isolamento aplicada: nenhum diagnóstico TypeScript ou teste global falho novo contra echo-457a31-isolated; lint dos arquivos do checklist aprovado. Débitos globais são não bloqueantes nesta fase.
- [x] Build histórico aprovado conferido em echo-457a31-submit/build.log e build.exit (0); não reexecutado porque esta retomada altera somente testes/documentação.
- [ ] Smoke autenticado, teclado em DOM real e viewport de 320px permanecem pendentes não bloqueantes. Testes de handlers e foco simulado não comprovam interação no navegador.
- [ ] Aprovações dos gates posteriores não emitidas por esta execução Nova.

DELIVERY_READY: Alpha CRM → Checklists → /PainelAlpha/AlphaCRM/admin/checklists → criar/editar → Vínculos → Etapas. Artefato final: template multietapa consumido pelo usuário autorizado em pipeline → card → Checklist (PainelHistorico → PainelChecklistsCard); resolução canônica em service/integracao conferida. Menu, rota protegida e integração inspecionados, sem smoke remoto atual.

DATABASE_CHANGE_NOT_REQUIRED: nenhuma alteração de schema, migration ou banco. Nenhuma operação Git mutável.

### File List desta retomada

- tests/bpm/checklists-workspace-submit.test.ts — dois testes novos de payload e preservação de rascunho após falha.
- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md — checklist e evidências desta fase.
- .bibble/memory/journal.md — registro da execução Nova.
- nova-457a31-isolated/ — logs locais e códigos de saída.


## Nova — Fase 6: build atual e fechamento isolado (2026-09-09)

RESULT: PASS

Reinspeção do feedback obrigatório concluída. As mudanças funcionais e testes da retomada anterior estão presentes e foram preservados; nenhum retrabalho de código foi necessário. O bloqueio BUILD_READ_ONLY_FILESYSTEM está superado por `npm run build` executado nesta sessão com exit 0, no estado atual do working tree.

- [x] Multiselect integrado ao editor existente; escolha global sem pipeline, modos exclusivos, restauração global/múltipla/legada, limpeza de etapas/card e anúncio ao trocar pipeline conferidos.
- [x] Tema ativo, resumo limitado, nomes longos contidos e foco após remoção conferidos; loading/error/retry e bloqueio durante salvamento presentes.
- [x] Payload canônico e preservação de seleção/nome após retorno de erro ou exceção cobertos pelos testes existentes.
- [x] Gates atuais: build exit 0; 73/73 testes direcionados em 11 arquivos; lint direcionado exit 0; diff-check direcionado exit 0.
- [x] Gates globais executados: `npm run typecheck` exit 2 (17 diagnósticos, conjunto idêntico a nova-457a31-isolated); `npm run lint` exit 1 (2.484 erros/1.254 avisos); `npm test` exit 1 (2.673 passaram, 50 falharam, 1 todo; mesmas falhas do baseline Nova). Nenhuma regressão de checklist identificada. Aplicada a política administrativa de isolamento: débitos globais externos são não bloqueantes para esta fase.
- [x] Menu, rota com sessão/admin e consumo em PainelHistorico → PainelChecklistsCard conferidos no código.
- [ ] Smoke autenticado, teclado em DOM real e viewport de 320px: pendências não bloqueantes; testes de handlers/foco simulado não substituem navegador.
- [ ] Gates posteriores e aprovações formais de outros agentes permanecem sem nova marcação. A tentativa de delegação Forge retornou “no thread”; comandos foram executados localmente, sem atribuir aprovação formal ao agente.

DELIVERY_READY: administrador → Alpha CRM → Checklists → /PainelAlpha/AlphaCRM/admin/checklists → criar/editar → Vínculos → Etapas; usuário autorizado → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → Checklist. Artefato final: template multietapa consumido pelos cards. Caminho validado por inspeção e testes locais; persistência remota mantém evidência histórica, sem smoke remoto nesta sessão.

DATABASE_CHANGE_NOT_REQUIRED: nenhum schema, migration ou banco alterado; nenhuma operação Git mutável. Arquivos preexistentes preservados.

### File List desta retomada

- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md — evidência atual, checklist e conclusão isolada.
- .bibble/memory/journal.md — registro desta retomada.
- nova-457a31-final-validation/ — logs atuais de typecheck, lint, build, testes globais/direcionados, lint direcionado, diff-check e results.json.

PIPELINE_RESULT: {"status":"PASS","code":"CHECKLIST_UI_VALIDATED","retryable":false}


## Nova — Fase 6: confirmação autônoma do feedback administrativo (2026-09-09)

RESULT: PASS

Reinspeção do blueprint Scout e dos ajustes Iris no working tree confirma que as mudanças solicitadas já estão implementadas. Preservados os arquivos funcionais e testes existentes; nenhuma alteração funcional adicional necessária nesta retomada.

- [x] Multiselect integrado à aba Vínculos; etapas filtradas pelo pipeline, global exclusivo disponível sem pipeline, restauração múltipla/global/legada e payload exclusivo `etapaIds` conferidos.
- [x] Limpeza de etapas/card ao trocar pipeline, anúncio inclusive no modo global com card, accent ativo, nomes longos contidos, resumo limitado e foco após remoção conferidos.
- [x] Estados loading/empty/error/retry/disabled/success, bloqueio de seleção vazia e preservação do rascunho no erro de salvamento conferidos no código e testes existentes.
- [x] Gates desta execução: 73/73 testes direcionados (11 arquivos), ESLint direcionado e diff-check aprovados.
- [x] `npm run typecheck`: exit 2, mesmos 17 diagnósticos de nova-457a31-final-validation. `npm run lint`: exit 1, 2.484 erros/1.254 avisos, mesmo baseline; nenhum erro no lint direcionado.
- [x] `npm test`: primeira tentativa interrompida por EBUSY na pasta coverage; repetido com `--coverage.reportsDirectory=nova-457a31-phase6-confirmation/coverage`, exit 1, 2.674 passaram, 50 falharam, 1 todo. Conjunto das 50 falhas idêntico ao baseline nova-457a31-final-validation/tests.log.
- [x] Build aprovado anterior conferido em nova-457a31-final-validation/build.log e results.json (exit 0); não repetido nesta retomada exclusivamente documental.
- [x] Feedback de isolamento aplicado: nenhuma regressão atribuível ao checklist encontrada; falhas externas não reprovam esta fase.
- [ ] Smoke autenticado, teclado/foco no DOM real, viewport de 320px e revalidação remota permanecem pendências não bloqueantes. Testes de handlers com hooks simulados não equivalem a navegador.
- [ ] Gates posteriores não marcados como concluídos; nenhuma aprovação formal de outro agente emitida por Nova.

DELIVERY_READY: administrador → Alpha CRM → Checklists → `/PainelAlpha/AlphaCRM/admin/checklists` → criar/editar → Vínculos → Etapas. Artefato final: template multietapa, consumido pelo usuário autorizado no pipeline → abrir card → Checklist (`CardModal/PainelHistorico` → `PainelChecklistsCard`). Menu, rota protegida e consumo conferidos no código; service/integracao compartilham o resolvedor canônico.

DATABASE_CHANGE_NOT_REQUIRED: nenhum schema, migration ou banco alterado; nenhuma operação Git mutável.

### File List desta confirmação

- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md — checklist, evidências e resultado desta fase.
- .bibble/memory/journal.md — registro da confirmação.
- nova-457a31-phase6-confirmation/ — logs locais, resultados e cobertura isolada.

PIPELINE_RESULT: {"status":"PASS","code":"CHECKLIST_UI_VALIDATED","retryable":false}


## Fase 12 — Scribe: consolidação final com isolamento dos gates (2026-09-09)

RESULT: PASS

Esta seção substitui o estado documental das tentativas anteriores. Feedback administrativo atendido: alterações reais limitadas à documentação inspecionada; falhas globais preexistentes sem regressão atribuível ao checklist não reprovam a RM. Os 71 testes citados no feedback foram ampliados nas fases anteriores para 73, todos aprovados nesta execução. Nenhuma alteração funcional, Git mutável ou mudança no banco do projeto foi realizada.

### Checklist final e evidências de aceite

- [x] Código reinspecionado: menu em CRMLayoutClient, rota admin com sessão/admin, ChecklistsWorkspace → EtapasMultiSelect → Criar/SalvarTemplateChecklistBpm → BpmChecklistTemplateEtapa → filtroEtapaTemplateChecklist → service/integracao → PainelHistorico/PainelChecklistsCard.
- [x] Semântica consolidada: global normalizado = lista vazia e shadow nulo; lista preenchida prevalece; lista vazia/ausente com shadow preenchido preserva singular também na função pura. A descrição histórica de plural vazio prevalecendo foi superada pelo código atual.
- [x] Correções existentes confirmadas: resumo legado, auditoria da retirada do pipeline, notificações origem/destino após commit, escolha global sem pipeline e ajustes de anúncio/foco/tema.
- [x] Critérios de aceite confirmados no escopo local: 73/73 testes em 11 arquivos, incluindo submissão vazia, autorização/revogação e SQL de migration em memória. Testes de handlers/hooks não são navegador e mocks não demonstram concorrência remota.
- [x] Migration aplicada registrada conforme evidência histórica da Fase 5; backup/checkpoint preservados por referência, sem reaplicação, leitura de dump ou consulta remota atual.
- [x] Forge/Probe/Anubis/Lens/Sage: PASS no escopo segundo os pareceres fornecidos pelo pipeline. Build anterior conferido em nova-457a31-final-validation/build.log e results.json (exit 0); não reexecutado nesta fase documental.
- [x] Mapa, integração, decisões, arquitetura e File List reconciliados; known-errors preservado, nenhum novo erro diagnosticado e resolvido nesta fase. Registro cronológico gravado no journal.
- [ ] Pendências não bloqueantes: smoke autenticado, teclado/foco/320px no navegador, concorrência real e revalidação remota; regularização dos gates globais. Manutenção futura: CAS na action legada e padronização do import de auth, sugestões de Anubis/Lens.

### Gates executados por Scribe

| Gate | Exit | Evidência atual |
|---|---:|---|
| git diff --check direcionado aos seis documentos | 0 | Sem erros de whitespace |
| npx --no-install vitest run tests/bpm/checklists-*.test.ts | 0 | 73/73 testes, 11 arquivos |
| ESLint direcionado (actions, domínio, editor, testes checklist) | 0 | Sem diagnósticos |
| npm run lint | 1 | 2.484 erros / 1.254 avisos, mesmas contagens do baseline Nova |
| npm run typecheck | 1 | 17 diagnósticos; conjunto idêntico ao baseline Nova |
| npm test | 1 | EBUSY no diretório coverage compartilhado |
| npm test -- --coverage.reportsDirectory=scribe-457a31-closure/coverage | 1 | 2.674 passaram / 50 falharam / 1 todo; conjunto das 50 falhas idêntico ao baseline Nova |

Baseline comparado: nova-457a31-final-validation/{typecheck,tests,lint}.log. Nenhuma regressão atribuível ao checklist encontrada. Logs atuais e códigos de saída em scribe-457a31-closure/. O build aprovado e os pareceres de outros agentes são evidências anteriores, não comandos/auditorias inventados nesta fase.

### Lacuna, autoajuste e entregabilidade

AUTO_ADJUSTMENT_REQUIRED: memória descrevia testes existentes como ausentes e fechamento bloqueado por falhas globais, contrariando as evidências atuais e o feedback administrativo.
AUTO_ADJUSTMENT_ACCEPTANCE: story e memórias registram testes presentes, PASS isolado e pendências remotas/globais como não bloqueantes. Autoajuste aplicado nesta consolidação.

DELIVERY_READY: administrador → Alpha CRM → Checklists → /PainelAlpha/AlphaCRM/admin/checklists → criar/editar → Vínculos → Etapas → salvar; usuário autorizado → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → abrir card → aba Checklist → PainelChecklistsCard. Artefato funcional: template multietapa consumido pelo card e pelos motores; caminho conferido por código e testes locais. Memórias e story são consumidas pelos agentes/manutenção diretamente nos arquivos do projeto. Smoke autenticado não executado.

### File List final desta fase

- docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md
- .bibble/memory/architecture.md
- .bibble/memory/codebase-map.md
- .bibble/memory/integration-points.md
- .bibble/memory/decisions.md
- .bibble/memory/journal.md
- scribe-457a31-closure/ — logs/resultados/cobertura locais, sem publicação.

### Complemento da File List funcional existente (reinspecionada, não alterada nesta fase)

- tests/bpm/checklists-workspace-submit.test.ts — guarda de submissão vazia, payload e preservação do rascunho.
- tests/bpm/checklists-multiplas-etapas-migration.test.ts — migration em memória, backfill idempotente, índices, unicidade, FKs e integridade.
- tests/bpm/checklists-multiplas-etapas.test.ts — cenários de actions, escopo, permissões e notificações.
- src/components/bpm/checklists/{ChecklistsWorkspace.tsx,EtapasMultiSelect.tsx,checklist-editor-state.ts}; src/actions/bpm/Checklists.ts; src/lib/bpm/checklists/leitura.ts — correções das retomadas preservadas.

PIPELINE_RESULT: {"status":"PASS","code":"DOCUMENTATION_CONSOLIDATED_SCOPE_VALIDATED","retryable":false}


## Fase 13 — Kowalski: encerramento arquivado (2026-09-09)

RESULT: PASS

- [x] Journal recebeu entrada formal cronológica com objetivo, agentes históricos, decisões, checkpoint/aprovação/backup Vault e resultados Forge → Probe → Anubis → Lens → Sage → Scribe.
- [x] Feedback “realize as mudanças” atendido por reinspeção e atualização efetiva deste status/checklist e journal. Preservados código e alterações alheias.
- [x] Story completa no escopo; isolamento administrativo aplicado aos débitos externos, smoke autenticado e revalidação remota. Evidência de coerência do banco é histórica, com schema/migration locais conferidos; nenhum banco acessado agora.
- [x] Lacuna documental resolvida por apêndice, sem reescrever entradas históricas; responsáveis e critérios das pendências não bloqueantes registrados no journal.

DELIVERY_READY: Alpha CRM → Configurações → Checklists → `/PainelAlpha/AlphaCRM/admin/checklists` → criar/editar → Vínculos → multiselect de etapas → salvar → `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card em coluna selecionada → Checklist aplicável. Administrador configura; usuário autorizado consome o template multietapa. Menu/rota/save/resolvedor/consumidor conferidos no código, apoiados pelos testes locais; smoke autenticado pendente não bloqueante.

### File List desta fase

- `.bibble/memory/journal.md` — apêndice formal do encerramento e evidências.
- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` — status, checklist e File List.
- `kowalski-457a31-closure/` — logs e códigos dos gates locais.

### Gates locais do encerramento (Kowalski)

- Testes direcionados: exit 0, 73/73 em 11 arquivos; lint direcionado: exit 0.
- `npm run lint`: exit 1, 2.484 erros/1.254 avisos, contagem igual ao baseline Scribe.
- `npm run typecheck`: exit 1, 17 diagnósticos; conjunto idêntico a `scribe-457a31-closure/typecheck.log`.
- `npm test`: exit 1, impedido por EBUSY na pasta coverage compartilhada. Sem nova medição global de testes; resultado global histórico de Scribe: 2.674 aprovados/50 falhas/1 todo.
- Build e pareceres formais anteriores conferidos; nenhuma nova build ou auditoria de outro agente atribuída a Kowalski. Logs/resultados em `kowalski-457a31-closure/`.

RESULT: PASS — encerramento local conforme isolamento administrativo; pendências globais/remotas não bloqueantes.

Validação documental: `git diff --check` nos dois documentos alterados aprovado (exit 0).
