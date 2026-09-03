# Story RM-2026-1EA5C1 — Visibilidade por colunas no CRM/BPM

**Objetivo do Roadmap:** Visibilidade por coluna
**Escopo confirmado:** módulo `PainelAlpha/AlphaCRM` (BPM), nas etapas/colunas de cada `BpmPipeline`.
**Projeto:** Painel Alpha
**Status:** Em testes
**Data:** 2026-09-02

## Contexto

Administradores precisam configurar, por etapa de um pipeline do CRM/BPM, quais perfis globais de usuário podem visualizar os cards daquela coluna e quais podem agir sobre eles. Exemplos do requisito: somente SDR em "Novos leads" e somente BDR em "Agendar reunião".

O perfil é o valor dinâmico de `usuarios.role`; não é o papel do vínculo no card (`BpmCardMembro.role`). Admin, CEO e TI mantêm o bypass administrativo já centralizado em `isAdminRole`.

## Regras funcionais

1. Sem regra configurada para uma etapa, o comportamento atual é preservado (acesso padrão).
2. Quando uma etapa possui ao menos uma regra, ela funciona como allow-list:
   - o perfil só vê/lista/abre cards se sua regra tiver `podeVer = true`;
   - o perfil só altera, move ou executa outras ações se sua regra tiver `podeAgir = true`;
   - `podeAgir` implica `podeVer`.
3. A regra de etapa é adicional às permissões já existentes do módulo e ao vínculo do usuário com o card.
4. Admin, CEO e TI podem ver e agir em todas as etapas.
5. Cards sem permissão de visualização não aparecem no Kanban e também são bloqueados no backend por acesso direto.
6. A etapa de destino também precisa autorizar ação antes de um movimento.
7. A configuração fica na página administrativa já existente do pipeline:
   `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`.

## Critérios de aceite

- [x] Admin visualiza uma seção "Visibilidade por coluna" na configuração do pipeline.
- [x] A UI lista todas as etapas ativas e os perfis ativos existentes no sistema.
- [x] Admin consegue habilitar/desabilitar "Pode visualizar" e "Pode agir" por perfil e etapa.
- [x] Salvar substitui atomicamente as regras da etapa e registra auditoria da configuração.
- [x] Etapa sem regras mantém o acesso atual (default allow).
- [x] Etapa com regras oculta cards para perfis não autorizados na listagem do Kanban.
- [x] Abertura direta de card sem `podeVer` é negada pelo servidor.
- [x] Edição, tarefas, anexos, exclusão e demais ações centralizadas sem `podeAgir` são negadas pelo servidor.
- [x] Movimento exige `podeAgir` na etapa atual e na etapa de destino.
- [x] Admin/CEO/TI mantêm bypass global.
- [x] Estado somente leitura é refletido na UI do card e o arrasto fica desabilitado.
- [x] Testes específicos, lint, typecheck, testes BPM e build foram executados sem regressões novas desta entrega.

## Desenho técnico

### Persistência

Nova tabela aditiva `BpmEtapaVisibilidade`, coerente com os IDs CUID e relações do BPM:

- `id String @id @default(cuid())`
- `etapaId String`
- `perfil String`
- `podeVer Boolean @default(true)`
- `podeAgir Boolean @default(false)`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- FK para `BpmEtapa` com `onDelete: Cascade`
- unicidade por `(etapaId, perfil)`; esse índice composto também atende buscas por `etapaId`

### Backend

- Criar helpers puros e de acesso em `src/lib/bpm/visibilidade-etapa.ts`.
- Criar Server Actions administrativas em `src/actions/bpm/VisibilidadeEtapas.ts`.
- Integrar a regra na fonte única de autorização, `src/lib/bpm/ownership.ts`.
- Filtrar a listagem em `ListarCardsPipelineBpm` e validar a etapa de destino em movimentos.
- Retornar a permissão efetiva para a UI desabilitar ações sem depender dela como fonte de verdade.

### Frontend

- Criar `VisibilidadeEtapasSection.tsx` na configuração administrativa do pipeline.
- Exibir uma grade por etapa/perfil com controles "Ver" e "Agir", estado vazio e feedback de salvamento.
- Desabilitar drag-and-drop e controles de mutação quando o usuário tiver somente leitura.

## Plano e progresso

- [x] Fase 0 — auditoria de entregabilidade e confirmação do módulo CRM/BPM.
- [x] Fase 1 — blueprint técnico e story.
- [x] Fase 2 — backup, migration local + Turso e verificação do schema.
- [x] Fase 3 — actions e enforcement backend.
- [x] Fase 4 — UI de configuração e estados somente leitura.
- [x] Fase 5 — auditoria de segurança.
- [x] Fase 6 — gates técnicos.
- [x] Fase 7 — verificação ponta a ponta por testes e inspeção de integração.
- [x] Fase 8 — documentação da arquitetura e decisões.
- [x] Fase 9 — journal e fechamento para "Em testes".

## File list

- `prisma/schema.prisma`
- `prisma/migrations/20260902174500_add_bpm_etapa_visibilidade/migration.sql` (novo)
- `src/lib/bpm/visibilidade-etapa.ts` (novo)
- `src/lib/bpm/ownership.ts`
- `src/actions/bpm/VisibilidadeEtapas.ts` (novo)
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Dashboard.ts`
- `src/actions/bpm/NolossLeads.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadeEtapasSection.tsx` (novo)
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `tests/bpm/visibilidade-etapa.test.ts` (novo)
- `tests/bpm/visibilidade-etapa-actions.test.ts` (novo)
- `tests/bpm/promover-noloss-lead.test.ts`
- `.bibble/memory/architecture.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/journal.md`
- `docs/stories/story-rm-2026-1ea5c1-visibilidade-colunas-crm-bpm.md` (novo)

## Evidências de fechamento

- Backup Turso pré-mudança: 261 tabelas, 47.643 linhas, 82.112.274 bytes, SHA-256 `549ab02cb1062679fdfa51a476413c416793326cdc12a82906ca3932b1a9d215`.
- Migration aditiva aplicada com confirmação explícita do usuário; tabela, índices, FK `CASCADE` e `PRAGMA foreign_key_check` validados no Turso (zero violações).
- 38/38 testes direcionados passaram; lint direcionado sem erros.
- Suíte BPM: 370 testes passaram e 16 falharam em 7 arquivos por débitos concorrentes/preexistentes do modal e um contrato `null`/`undefined`, sem falha nos testes desta entrega.
- Build compilou a aplicação, mas o gate global continua bloqueado ao coletar `/PainelAlpha/Parceiros/[id]` por `CardFilhoCriado is not defined`, erro preexistente e fora deste objetivo.
- `npm run lint` global continua bloqueado por 3.771 ocorrências históricas (incluindo `.aiox-core`); os arquivos desta entrega passam no lint direcionado.
- `tsc --noEmit` global requer 8 GiB e reporta erros preexistentes fora dos arquivos desta entrega; o build compilou os arquivos alterados sem erro.
- Validação visual autenticada não foi executada neste ambiente; o card segue para teste manual no pipeline.

## Fora de escopo

- Criar perfis SDR/BDR automaticamente. Os perfis são dinâmicos e vêm de `usuarios.role`.
- Alterar as colunas do Roadmap ou outros módulos fora do Alpha CRM/BPM.
- Promover o card para Produção; o objetivo deve terminar em "Em testes".
