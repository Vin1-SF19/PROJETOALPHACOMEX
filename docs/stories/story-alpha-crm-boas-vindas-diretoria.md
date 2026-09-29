# Story — Operacional: Boas-vindas com alerta e acesso da diretoria

**Status:** Implementação local validada; publicação da configuração pendente de autorização Vault
**Data:** 2026-08-14

## Objetivo

Dar destaque aos cards de **Boas-vindas** até o início do atendimento e restringir as ações da coluna a Admin e Vitor, preservando a consulta conforme as permissões publicadas.

## Retomada — Boas-vindas e início do atendimento (29/09/2026)

O pedido atual amplia a story para o pipeline Operacional ativo, etapa inicial Boas-vindas. Os dados da negociação/análise devem acompanhar o card em todas as etapas do Operacional, reutilizando as fontes canônicas do Radar, Financeiro e cliente. **Estado foi expressamente excluído deste acréscimo.**

### Critérios de aceite da retomada

1. O card Operacional apresenta Embasamento do processo, Radar pretendido, Radar atual, Mês de protocolo, Regime tributário, Data de abertura da empresa, Situação do capital social, Faturamento dos últimos 5 anos, Status da sede, Armazenagem, Contas/faturas, Produtos comercializados, Atuação da empresa, Tributos pagos nos últimos 6 meses, Fonte, Vendedor(a) e Contato responsável/representante. Esses 17 dados continuam acessíveis nas etapas seguintes, sem cópias contraditórias. Não acrescentar Estado por este pedido. Quando um dado não chegou da negociação, Admin/Vitor pode preenchê-lo em Boas-vindas; sua falta não impede a criação do card, mas impede a saída da etapa.
2. Os campos acrescentados e suas apresentações, tipos, opções e obrigatoriedade aplicável são administráveis em **Configurações → Campos e Formulários**. O servidor respeita a configuração publicada e preserva os valores históricos.
3. A entrada em Boas-vindas ocorre após a contratação válida, com contrato assinado e pagamento confirmado, preservando a NF e os demais requisitos da etapa Concluído do Financeiro. O encaminhamento existente permanece idempotente e vinculado à negociação original.
4. O processo novo sem boas-vindas recebe alerta destacado, observável pela diretoria até ocorrer a primeira ação de boas-vindas. A semântica de conclusão das boas-vindas não pode ser confundida com a mera primeira abertura do card.
5. Somente a conta Admin e o usuário Operacional Vitor podem agir na coluna Boas-vindas, inclusive atribuir o processo a uma analista e definir a primeira reunião. A autorização de Vitor usa o ID da conta verificada, não libera genericamente o cargo Operacional. A atribuição e a data/hora da reunião ficam registradas com autor e momento, com validação no servidor. A analista atribuída só passa a agir conforme as permissões da etapa seguinte.
6. O campo de data e hora da primeira reunião é configurável na UI e vinculado ao compromisso real. O Diretor escolhe data e hora ao atribuir a analista; o sistema cria o evento Google Agenda/Meet automaticamente a partir dessa escolha, convidando a analista e o contato do cliente, sem inventar horário. Falha na criação do evento não pode deixar uma atribuição com reunião falsamente marcada como agendada.

### Checklist da retomada

- [x] Inventariar o pipeline Operacional ativo (v8, 13 etapas), formulários e campos publicados; mapear os 17 dados para as fontes canônicas e diagnosticar lacunas de cópia/consulta.
- [x] Auditar o alerta atual de Boas-vindas, a restrição de acesso e a atribuição de responsável; manter o alerta até a saída da etapa.
- [x] Definir com o usuário a regra de data/hora da primeira reunião e a identidade da diretoria nesta coluna; registrar a decisão antes da automação. Horário escolhido na atribuição; acesso para Admin e usuário Operacional Vitor, sujeito à confirmação read-only do ID.
- [x] Implementar e testar a leitura dos dados em todas as etapas, a configuração na UI, a atribuição restrita e o agendamento conforme decisão.
- [x] Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar File List e evidências.
- [ ] Antes de qualquer publicação no Turso: relatório Vault, backup completo verificado com até 48 horas e autorização específica para esta retomada. Nenhuma autorização anterior cobre a operação.

### Integração e decisões pendentes

- Reutilizar o handoff Financeiro → Operacional já publicado; não criar outro card nem outra automação de saída sem lacuna comprovada.
- A story anterior tratava `Admin` como diretoria canônica porque não havia cargo `Diretor` cadastrado. A decisão nova também autoriza o usuário Operacional Vitor individualmente.
- `[USER-DECISION — 29/09/2026]` O Diretor escolhe a data e hora da primeira reunião ao atribuir a analista. A criação do evento Google Agenda/Meet é automática e convida analista e contato do cliente.
- `[USER-DECISION — 29/09/2026]` Admin e o usuário Operacional Vitor podem agir na coluna. A permissão de Vitor é individual; a conta ativa verificada tem ID `10`, role `OPERACIONAL` e cargo `Diretor Operacional`.
- `[USER-DECISION — 29/09/2026]` Dados da negociação que ainda não foram capturados podem ser preenchidos em Boas-vindas. A entrada no Operacional não é bloqueada por essa falta; todos os 17 dados são exigidos na saída de Boas-vindas.
- O repositório possui alterações preexistentes em arquivos de autosave de outro trabalho. Elas não integram esta story.

## Regra de negócio

- No pipeline `Operacional`, somente `Admin` e o usuário Vitor (ID 10, cargo Diretor Operacional) podem executar ações em Boas-vindas; o nome publicado `Boas vindas` também deve ser reconhecido. A decisão específica de 29/09/2026 substitui a antiga autorização genérica por role `DIRETOR`.
- `CEO`, `TI`, demais usuários `OPERACIONAL`, responsável e administrador do card não recebem bypass de ação nesta coluna. Os membros que não podem agir ainda podem consultar conforme a permissão de leitura publicada.
- A regra é aplicada no backend, incluindo leitura, alteração, movimentação, tarefas, anexos e demais actions que usam `exigirAcessoBpmCard`.
- Listagens do board, perfil de empresa, dashboard e central de tarefas filtram esses cards para quem não é diretoria.
- Enquanto o card permanecer em Boas-vindas, o board mostra alerta destacado **Boas-vindas pendentes — requer atenção**; a primeira abertura do card não remove o alerta.

## Arquivos alterados

- `src/lib/bpm/boas-vindas.ts`
- `src/lib/bpm/ownership.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Empresas.ts`
- `src/actions/bpm/Dashboard.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `tests/bpm/boas-vindas-acesso.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/membros-card-ui.test.ts`
- `tests/bpm/cpf-fechamento-react.test.ts`
- `tests/bpm/exclusao-modal-board-react.test.ts`
- `src/actions/bpm/Membros.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`

### File List da retomada de 29/09/2026

- `docs/stories/story-alpha-crm-boas-vindas-diretoria.md`
- `scripts/diagnosticar-boas-vindas-operacional.mts`
- `scripts/configurar-boas-vindas-operacional.mts`
- `src/lib/bpm/boas-vindas.ts`
- `src/lib/bpm/ownership.ts`
- `src/lib/bpm/campos-configuraveis.ts`
- `src/lib/bpm/campos-configuraveis-server.ts`
- `src/lib/bpm/transicao-command.ts`
- `src/actions/bpm/GoogleMeet.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelBoasVindasOperacional.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `tests/bpm/boas-vindas-acesso.test.ts`
- `tests/bpm/boas-vindas-operacional.test.ts`
- `tests/bpm/boas-vindas-agendamento-action.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/exclusao-modal-board-react.test.ts`
- `tests/bpm/membros-card-ui.test.ts`

### Evidências da retomada

- Prévia read-only do Turso v8 → v9: 17 campos de análise, 2 de processo, 8 novos, 12 formulários adicionais, Boas v1 → v2 e handoff v1 → v2. Nenhum card existente alterado.
- Testes focados de acesso, regras e agendamento: 11 aprovados; testes de integração ajustados: 30 aprovados.
- `npm run lint`: 0 erros; 1.191 avisos preexistentes.
- `npm run typecheck`: aprovado.
- `npm test`: 558 arquivos aprovados; 4.061 testes aprovados, 4 ignorados, 1 pendente.
- `npm run build`: aprovado.
- Backup Vault dedicado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T16-44-59-857Z.sql`, gerado em 29/09/2026 às 16:44:59 UTC, 182.429.762 bytes, 332 tabelas, 194.023 linhas. Manifesto `.manifest.json` adjacente, SHA-256 `870e1402fd35d9a633a07cb7da0f2425d8773977d846e7dc8a4188c8e2e3560f`. Restauração isolada aprovada por `scripts/verify-turso-backup.mjs`: hash, tamanho, tabelas, linhas, integridade e chaves estrangeiras.
- `prisma migrate diff --script`: migration vazia; não há mudança estrutural.
- A publicação da configuração no Turso permanece bloqueada pelo protocolo Vault até aprovação específica do usuário.

## Verificação

- [x] Testes focados de autorização e UI — 22 testes
- [x] Bloquear vínculo de pessoas em Boas-vindas/Operacional para cargos fora de Admin/Diretor, no backend e na UI
- [x] Suíte BPM — 41 arquivos / 243 testes
- [x] ESLint focado nos arquivos alterados
- [x] `git diff --check`
- [x] `npm run lint` — 0 erros, 1.191 avisos existentes
- [x] `npm run typecheck` — aprovado
- [x] `npm test` — 525 arquivos, 3.893 testes aprovados, 4 ignorados e 1 todo; fixtures de modal e expectativas de permissão atualizadas
- [x] `npm run build` — aprovado

## Publicação da configuração

Não há migration de schema. A publicação adiciona definições/configurações BPM e uma versão da automação; depende do protocolo Vault acima.
