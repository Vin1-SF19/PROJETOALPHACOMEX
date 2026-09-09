# Story — RM-2026-457A31: Checklist em várias etapas

## Status

Pronta para desenvolvimento em 2026-09-08. Em 2026-09-09, o pipeline registrou aprovação administrativa específica do checkpoint Vault e foi gerado um backup novo, específico e restaurável. Esta fase de aprovação não cria nem aplica schema, migration, DDL ou backfill; esses passos permanecem reservados à fase executora.

## Objetivo

Permitir que um template do Checklist Builder seja global para todas as etapas ou restrito a uma, várias ou todas as etapas do pipeline escolhido, com edição acessível, persistência coerente e a mesma resolução de escopo na administração, na materialização do card, no bloqueio de movimento, no Motor de Regras e no Motor de Automações.

## Contexto auditado e blueprint do Scout

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

### Entrega funcional planejada

- Configuração: administrador autenticado → `Alpha CRM` → `Configurações` → `Checklists` → `/PainelAlpha/AlphaCRM/admin/checklists` → criar/editar template → escolher pipeline → definir “Todas as etapas” ou “Etapas selecionadas”.
- Consumo: usuário autorizado → `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card → painel esquerdo → aba **Checklist** → materialização e operação do checklist aplicável.
- Consumidores indiretos: guarda de movimento, Motor de Regras e Motor de Automações, todos por meio de `carregarResumoChecklistAplicavelCard` e da regra canônica compartilhada.

`DELIVERY_READY`: a navegação administrativa, a rota protegida, as actions existentes e a aba Checklist do card já fornecem o caminho de acesso; a associação multietapa e sua resolução permanecem como implementação desta story.

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

## Decisão de domínio proposta

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
- [ ] Um template global é aplicável a todas as etapas compatíveis; um template restrito é aplicável somente às etapas selecionadas.
- [ ] O backfill preserva templates legados singulares e não transforma nenhum deles em global.
- [ ] O shadow legado é mantido de forma determinística durante a janela de transição.
- [ ] Salvamento de template, itens, associações e auditoria é atômico e protegido por sessão, permissão `configurarChecklists` e validação transacional de ownership.
- [ ] `service.ts` e `integracao.ts` usam a mesma função canônica de aplicabilidade.
- [ ] O mesmo escopo alimenta materialização, resumo, bloqueio de movimento, Regras e Automações.
- [ ] A unicidade `BpmCardChecklist(cardId, templateId)` continua impedindo duplicação sob reload ou concorrência.
- [ ] Checklists já materializados não são reescritos após alteração de escopo do template.
- [ ] O fluxo é validado da tela administrativa até o checklist consumido no card.
- [ ] Nenhuma regressão ocorre para templates globais, card específico ou pipelines sem templates aplicáveis.

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
- [ ] Criar migration aditiva e idempotente somente após aprovação.
- [ ] Validar pós-aplicação: tabela, índices, FKs, contagens do backfill, zero vínculo inválido e `foreign_key_check` sem violações.

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

- [ ] Estrutura aditiva, FKs e índices esperados, sem `DROP`/`RENAME`.
- [ ] Unicidade composta aceita vários templates na mesma etapa e rejeita duplicação do mesmo par.
- [ ] Backfill singular é idempotente e preserva contagens/aplicabilidade.
- [ ] Preflight recusa etapa órfã ou pertencente a outro pipeline.

### Domínio e actions

- [ ] Schemas aceitam global, uma e várias etapas; deduplicam/rejeitam excesso e IDs inválidos.
- [ ] Etapa de outro pipeline, etapa inativa e seleção específica sem pipeline são rejeitadas.
- [ ] Criar, editar, remover parte dos vínculos e alternar para global reconciliam o conjunto correto.
- [ ] Falha intermediária reverte template, itens, associações e auditoria.
- [ ] Sessão/permissão/ownership são exigidos também em chamada direta.
- [ ] Conflito por `updatedAt` não sobrescreve edição concorrente.

### Aplicabilidade e integração

- [ ] Template global aplica-se em qualquer etapa compatível.
- [ ] Template com uma etapa aplica-se somente nela.
- [ ] Template com várias etapas aplica-se em todas as selecionadas e em nenhuma outra.
- [ ] Template singular legado mantém o comportamento depois do backfill.
- [ ] Materialização manual e `MATERIALIZAR_CHECKLIST` usam a mesma resolução e permanecem idempotentes.
- [ ] Resumo, bloqueio de movimento, Regras e Automações produzem o mesmo resultado de aplicabilidade.
- [ ] Instâncias existentes permanecem inalteradas após edição do template.

### UI e entrega ponta a ponta

- [x] Multiselect é operável por teclado, possui nome acessível e expõe seleção/erro sem depender de cor.
- [x] Alternância global↔específica é exclusiva e preserva o rascunho quando o servidor recusa o salvamento.
- [x] Edição/reload restaura duas ou mais etapas e mantém fallback singular legado explícito.
- [x] Troca de pipeline limpa etapas/card e lista somente opções válidas.
- [ ] Administrador salva template com duas etapas; card em cada etapa selecionada materializa uma única instância; card fora delas não materializa.
- [ ] Caminho administrativo e aba Checklist do card permanecem acessíveis pelas rotas existentes.

### Gates do projeto

- [ ] `npm run lint`.
- [ ] `npm run typecheck`.
- [ ] `npm test`.
- [ ] `npm run build` conforme Constitution/Forge.
- [ ] Testes direcionados de checklist e migration.
- [ ] `git diff --check`.

## Tarefas por agente

- [x] **Scout** — auditar contexto, persistência, consumidores, entregabilidade e fornecer blueprint.
- [x] **Nova (Fase 2)** — formalizar esta story sem antecipar código funcional.
- [x] **Vault (Fase 4)** — produzir o checkpoint auditável sem editar schema ou criar/aplicar migration.
- [ ] **Vault (fase executora)** — reutilizar o backup específico válido desta retomada se ainda estiver dentro de 48 horas; caso contrário gerar outro, e então revisar/aplicar migration e backfill e validar o banco.
- [ ] **Echo/Dev** — implementar schemas, leitura canônica, actions, persistência e integração operacional.
- [x] **Nova** — implementar o multiselect acessível e os estados de edição no `ChecklistsWorkspace` após o gate de dados estar disponível.
- [ ] **Anubis** — auditar autenticação, autorização, ownership, validação e payload de auditoria.
- [ ] **Forge** — executar typecheck, lint e build reais.
- [ ] **Probe** — validar o fluxo completo da configuração administrativa ao checklist no card e seus consumidores indiretos.
- [ ] **Lens** — revisar qualidade e arquitetura somente após Forge aprovar.
- [ ] **Sage** — validar casos extremos, concorrência, compatibilidade legada e regressões.
- [ ] **Scribe/Kowalski** — atualizar mapas, decisões, componentes, integrações e journal no encerramento.

## File List inicialmente planejada

### Criar

- [x] `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md`.
- [ ] `prisma/migrations/<timestamp>_bpm_checklist_template_multiplas_etapas/migration.sql`.
- [ ] `tests/bpm/checklists-multiplas-etapas-migration.test.ts`.

### File List real da Fase 4

- `docs/stories/story-rm-2026-457a31-checklist-varias-etapas.md` — checkpoint Vault, evidências, plano, riscos, rollback, entregabilidade e estado `WAITING_APPROVAL`.
- `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-09T12-29-03-247Z.sql` e manifesto irmão — novos, específicos desta RM, ignorados pelo Git e validados por restauração.
- Nenhum arquivo em `prisma/schema.prisma` ou `prisma/migrations/` foi criado/editado por esta fase.

### Editar

- [ ] `prisma/schema.prisma`.
- [ ] `src/lib/bpm/checklists/schemas.ts`.
- [ ] `src/lib/bpm/checklists/leitura.ts`.
- [ ] `src/actions/bpm/Checklists.ts`.
- [ ] `src/components/bpm/checklists/ChecklistsWorkspace.tsx`.
- [ ] `src/lib/bpm/checklists/service.ts`.
- [ ] `src/lib/bpm/checklists/integracao.ts`.
- [ ] `tests/bpm/checklists-actions.test.ts`.
- [ ] `tests/bpm/checklists-domain.test.ts`.
- [ ] `tests/bpm/checklists-service.test.ts`.
- [ ] `tests/bpm/checklists-integracao-motores.test.ts`.
- [ ] `tests/bpm/checklists-entrega-shell.test.ts`.
- [ ] `.bibble/memory/architecture.md`.
- [ ] `.bibble/memory/codebase-map.md`.
- [ ] `.bibble/memory/components.md`.
- [ ] `.bibble/memory/decisions.md`.
- [ ] `.bibble/memory/integration-points.md`.
- [ ] `.bibble/memory/journal.md`.

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

Gates posteriores (Forge, Probe, Anubis, Lens, Sage, Scribe/Kowalski) permanecem pendentes nesta fase.
