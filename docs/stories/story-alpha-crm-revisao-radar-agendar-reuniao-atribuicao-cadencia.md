# Story: Revisão de Radar — atribuição e operação de Agendar Reunião

## Status

In Progress — código preparado e configuração publicada no Turso; deploy do código, homologação autenticada e revisão final pendentes.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `test`, `build`, CodeRabbit e homologação autenticada.

## Story

**Como** usuário comercial do Alpha CRM, **quero** escolher o responsável ao mover um lead de Novo Lead para Agendar Reunião e trabalhar a reunião com campos, cadência e saídas configuráveis, **para que** o atendimento tenha dono definido e cards sem Próximo Contato recebam as tentativas previstas antes de ir para Stand By.

## Contexto e precedência

Pedido explícito do usuário para a coluna **Agendar Reunião** do pipeline **Revisão de Radar**. Esta story complementa `story-alpha-crm-revisao-radar-novo-lead-validacoes-cadencia.md`. Para este pipeline, a decisão mais recente estabelece **a mesma cadência de Novo Lead: uma ligação registrada por dia útil durante oito dias úteis, excluindo feriados nacionais**. Essa decisão prevalece sobre a regra anterior, em `story-alpha-crm-agendar-reuniao-regras-automacao.md`, que contava feriados como dias úteis e não exigia ligação diária. Não propagar essa alteração a outros pipelines.

Já existem `BpmCard.dataReuniao` e `BpmCard.proximoContatoEm`, ação de agendamento pelo Google Meet e edição do script por etapa. Reutilizar essas fontes; não criar campos de valor duplicados. O script comercial desta etapa deve ficar vazio inicialmente, para preenchimento posterior pelo usuário na UI. A etapa atual e a configuração persistida devem ser relidas antes de qualquer publicação. A exceção já aprovada para CNPJ de origem NoLoss deve continuar válida no movimento para Agendar Reunião.

## Acceptance Criteria

1. Ao mover um card de **Novo Lead** para **Agendar Reunião**, por drag ou outra ação de movimento do board, abre-se um modal que pergunta se o lead será atribuído **a mim** ou **a outro usuário**. A opção “a mim” resolve o usuário autenticado; “outro usuário” permite selecionar um usuário elegível ao pipeline. A confirmação apresenta o destinatário e só então conclui o movimento.
2. Cancelar ou fechar o modal deixa card, etapa, responsável, membros e histórico como estavam. Falha de validação ou persistência restaura a posição visual do card e mostra o motivo. O servidor valida autorização e elegibilidade do novo responsável e aplica atribuição e movimento de forma consistente, sem card movido com atribuição parcial.
3. A etapa **Agendar Reunião** disponibiliza **Data da reunião**, **Hora da reunião** e **Próximo Contato** no formulário do card. Data e Hora compartilham o valor canônico `BpmCard.dataReuniao`; Próximo Contato usa `BpmCard.proximoContatoEm`. O preenchimento e a limpeza de Próximo Contato continuam sujeitos às permissões do card.
4. Para avançar manualmente de **Agendar Reunião** a **Reunião Agendada**, Data e Hora válidas são obrigatórias. O backend verifica o valor persistido e recusa transição por UI ou chamada direta quando ausente ou inválido, sem update nem histórico parcial. **Stand By** permanece como saída operacional possível sem reunião marcada.
5. As únicas saídas manuais permitidas de **Agendar Reunião** são **Reunião Agendada** e **Stand By**, tanto no board quanto no backend e na matriz persistida de transições. Outros destinos são recusados sem alterar o card.
6. A cadência de **Agendar Reunião** é criada e publicada em **Configuração → Cadências**, vinculada a esta etapa: **uma ligação registrada por dia útil, durante oito dias úteis** a partir da entrada na etapa, descontando sábados, domingos e feriados nacionais. Ela pode ser editada ou apagada pela UI. O job lê e respeita a versão persistida vigente; não usa uma regra fixa que continue rodando após edição, desativação ou exclusão. Enquanto `proximoContatoEm` estiver vazio e o card permanecer ativo na etapa, a UI mostra progresso e dias sem registro; não cria ligações fictícias.
7. Informar **Próximo Contato** interrompe a cadência automática e impede o envio automático para Stand By enquanto o valor estiver presente. Ao limpar o campo, a elegibilidade volta a ser calculada pelo estado e histórico persistidos, sem duplicar tentativas.
8. Depois de esgotada a cadência **configurada e ainda ativa** e registradas as tentativas exigidas por ela, se o card continuar ativo em Agendar Reunião e sem Próximo Contato, a automação o move para **Stand By** uma única vez. Reexecução ou concorrência não duplica movimento nem histórico; o evento de atualização do board é emitido após persistência. Uma ligação ausente não é presumida como realizada. Se a cadência for apagada ou desativada, o job deixa de executar esta regra para a etapa.
9. A etapa mantém um botão funcional para **agendar pelo Google Meet** no fluxo existente, sem duplicar eventos ao reabrir ou mover o card. O **script comercial específico** fica vazio inicialmente e pode ser preenchido ou editado depois pelo usuário na UI de script da etapa; nenhum texto padrão é criado por esta story.
10. **Data da reunião, Hora da reunião e Próximo Contato** ficam visíveis e configuráveis na UI de **Configurações → Campos e Formulário** do pipeline e da etapa Agendar Reunião. O editor deve representar os controles nativos com referência aos valores canônicos e permitir a configuração suportada pela plataforma; não criar `BpmCampo` de valor paralelo. Campos adicionais efetivamente criados para esta etapa também aparecem no catálogo e no formulário configurável.
11. A solução reutiliza o processamento CLI/job autenticado existente para a cadência; não cria segundo scheduler. O estado da configuração e o resultado de cada execução são observáveis. Mudança persistente de cadência, campos, formulário ou transições só ocorre após cumprir o protocolo Vault e receber autorização específica para esta publicação.
12. Testes cobrem as duas escolhas de atribuição, cancelamento, falha/rollback, permissões, CNPJ opcional de NoLoss, validação de Data/Hora, duas saídas permitidas, interrupção por Próximo Contato, oito dias úteis com feriado nacional, tentativa ausente, edição/exclusão da cadência respeitada pelo job, idempotência, Google Meet, script inicialmente vazio e editável, e exposição dos controles na UI de configuração. Passam `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` antes de concluir; checklist e File List são atualizados.

## Decisions and limits

- [AUTO-DECISION] “Dias seguidos” do pedido → interpretar conforme esclarecimento do usuário como **oito dias úteis**, uma ligação registrada por dia, feriados nacionais excluídos. Não usar oito dias corridos nem cinco ligações por dia.
- [AUTO-DECISION] “Próximo Contato interrompe cadência” → usar a presença de `BpmCard.proximoContatoEm` como condição operacional; uma ligação registrada isoladamente não prova resposta.
- A implementação do editor usa referências aos controles nativos, sem criar valores paralelos. A publicação persistente desta etapa recebeu autorização específica e foi executada conforme o relatório Vault. Se surgir necessidade de estrutura, migration, seed, backfill ou mutação em massa adicional, reavaliar pelo Vault antes de executar.
- **Fora do escopo:** criar texto do script comercial, segundo cron, novas regras para outros pipelines ou exigir CNPJ de lead NoLoss. A edição posterior da cadência usa a UI existente de Configuração → Cadências.

## Tasks / Subtasks

- [x] 1. Reler configuração ativa, transições, formulário, controles nativos, movimento, atribuição e entrypoints do job/CLI (AC 1–5, 9–11).
- [x] 2. Preparar modal de atribuição para Novo Lead → Agendar Reunião e operação de servidor consistente com autorização e rollback visual (AC 1–2); homologação autenticada pendente.
- [x] 3. Concluir guardas e limitar saídas a Reunião Agendada/Stand By (AC 3–5, 7); homologação autenticada pendente.
  - [x] Preparar guardas no código e prévia da matriz de transições.
  - [x] Publicar e conferir a matriz de transições no banco após autorização: somente Reunião Agendada e Stand By.
- [ ] 4. Configurar a cadência editável em Configuração → Cadências e adaptar o job compartilhado (AC 6–8, 11).
  - [x] Preparar cálculo dos dias úteis, feriados, leitura dos passos persistidos e pausa por Próximo Contato no código.
  - [x] Publicar cadência ativa com oito passos `LIGACAO` e intervalos `0, 1×7` na configuração persistida.
  - [ ] Confirmar edição/exclusão da cadência pela UI autenticada.
- [ ] 5. Preservar Google Meet e script vazio; mostrar Data, Hora e Próximo Contato em Campos e Formulário (AC 9–10).
  - [x] Preparar representação dos controles nativos no editor sem duplicar valores e preservar Google Meet/script.
  - [x] Publicar formulário ativo com `MEETING_SCHEDULER` e `FOLLOW_UP_SCHEDULER`; confirmar script vazio por leitura remota.
  - [ ] Homologar editor, formulário, Meet e script vazio na UI autenticada após deploy do código.
- [x] 6. Publicar configuração persistente pelo gate Vault (AC 5, 10–11).
  - [x] Preparar relatório Vault, backup completo verificado e prévia remota somente leitura da versão 12.
  - [x] Registrar autorização específica “Sim, autorizo”; revalidar backup/prévia, aplicar transação no Turso e verificar `configVersion` 12→13, auditoria admin 8 e `PRAGMA foreign_key_check` sem violações.
- [ ] 7. Validar integralmente AC 1–12 e concluir gates/QA (AC 12).
  - [x] `npm run lint` passou com zero erros e 1191 avisos do repositório; `npm test` passou com 534 arquivos/3951 testes; `npm run build` e `npm run typecheck` (repetido após build) passaram.
  - [ ] Cobrir ou homologar cenários ainda sem evidência direta, revisar CodeRabbit/QA e atualizar o resultado final após homologação.

## Dev Notes

- `src/actions/bpm/Cards.ts`: autorização, movimento, responsável, `dataReuniao`, `proximoContatoEm` e histórico.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`: board, drag e fluxo existente de promoção NoLoss com modal de responsável; esse modal não equivale automaticamente ao novo fluxo para card real.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`: agendamento Google Meet e Data/Hora.
- `src/lib/bpm/agendar-reuniao.ts`: guard existente para Reunião Agendada.
- `src/lib/bpm/novos-leads.ts` e `src/lib/bpm/automacao-novos-leads.ts`: regra atual de oito dias úteis e execução compartilhada; verificar implementação efetiva antes de estender à etapa.
- `src/actions/bpm/Conhecimento.ts`: edição do script persistido na etapa; manter o conteúdo vazio inicialmente e disponível para preenchimento posterior.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`: editor de formulário da etapa. `src/actions/bpm/Campos.ts` e `FormulariosEtapa.ts` fazem parte do contrato de configuração.
- Story anterior `story-alpha-crm-agendar-reuniao-regras-automacao.md` cobre guard e processamento histórico, mas as regras de feriado/cadência divergentes não se aplicam à Revisão de Radar deste pedido.
- `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados no workspace no momento do rascunho; não foi inferido contexto de arquivos ausentes.

### Testing

- Testes de regras e actions em `tests/bpm/`, com datas determinísticas e feriado nacional no período.
- Teste de UI deve exercitar modal, cancelamento, erro/rollback e controles no editor; teste de integração deve confirmar transição, atribuição, histórico e idempotência.
- Não executar job de automação em banco compartilhado como teste; usar mocks/fixtures, além de prévia somente leitura antes de eventual publicação.

## CodeRabbit Integration

**Primary Type:** Full-stack / workflow. **Secondary Type(s):** configuração persistida, automação, integração Google Meet. **Complexity:** alta.

### Specialized Agent Assignment

- `@dev`: implementação e pré-commit.
- `@qa`: cobertura e revisão funcional.
- `@ux-design-expert`: modal, acessibilidade e editor.
- `Vault`: gate para mutações persistentes protegidas pelo `AGENTS.md`.
- `@devops`: PR/deploy, se solicitados.

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): lint, typecheck, test, build e CodeRabbit; validar autorização, consistência de atribuição e idempotência.
- [ ] Pre-PR (`@devops`): validar configuração e compatibilidade do job/CLI, se houver PR.
- [ ] Pre-Deployment (`@devops`): verificar cron único, configuração publicada e rollback, se houver deploy.

### Self-Healing Configuration

- Primary Agent: `@dev` (light mode); máximo 2 iterações, 15 minutos, filtro CRITICAL.
- CRITICAL: corrigir dentro do limite; HIGH: documentar para revisão. `@qa` usa full mode (3 iterações, 30 minutos, CRITICAL/HIGH); `@devops` reporta sem autocorreção.

### CodeRabbit Focus Areas

- Autorização e elegibilidade na escolha do responsável; movimento e atribuição sem persistência parcial.
- Guard de Data/Hora no servidor, só para Reunião Agendada; Stand By operacional preservado.
- Cadência, feriado nacional, Próximo Contato e update condicional/idempotente.
- Editor configurável para valores nativos sem `BpmCampo` duplicado; configuração de cadência lida pelo job após editar/apagar; Google Meet e edição do script vazio preservados.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story do pedido atual, com precedência da cadência esclarecida pelo usuário. | River (`@sm`) |
| 2026-09-28 | 0.2 | Cadência configurável pela UI com edição/exclusão efetiva; script inicialmente vazio e editável. | River (`@sm`) |
| 2026-09-28 | 0.3 | Progresso real, gates, File List e pendências de publicação/homologação registrados. | River (`@sm`) |
| 2026-09-28 | 0.4 | Publicação autorizada e verificada no Turso; deploy e homologação continuam pendentes. | River (`@sm`) |

## Dev Agent Record

### Completion Notes

Código preparado para atribuição no movimento, controles nativos no editor e leitura da cadência configurada pelo job. Após autorização específica, backup e prévia foram revalidados e `scripts/configurar-agendar-reuniao-radar.mts --apply` publicou a configuração no Turso, elevando `configVersion` de 12 para 13. Leitura remota confirmou formulário ativo com `MEETING_SCHEDULER` e `FOLLOW_UP_SCHEDULER`, saídas somente para Reunião Agendada e Stand By, cadência ativa com oito passos `LIGACAO` (intervalos `0, 1×7`), script vazio, auditoria atribuída ao admin 8 e zero violações em `PRAGMA foreign_key_check`. Deploy do código e homologação autenticada continuam pendentes.

### File List

- `docs/stories/story-alpha-crm-revisao-radar-agendar-reuniao-atribuicao-cadencia.md` — story e acompanhamento.
- `docs/reports/vault-revisao-radar-agendar-reuniao-2026-09-28.md` — relatório Vault e gate de publicação.
- `scripts/configurar-agendar-reuniao-radar.mts` — prévia/aplicação protegida da configuração.
- `src/lib/validations/bpm.ts` — contrato de entrada.
- `src/actions/bpm/Cards.ts` — movimento/atribuição.
- `src/lib/bpm/transicao-command.ts` — comando transacional da transição.
- `src/app/PainelAlpha/AlphaCRM/CardModal/AtribuirLeadAgendarModal.tsx` — escolha do responsável.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` — integração no card aberto.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` — integração na ação de avanço.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — integração no board.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — controles nativos na configuração.
- `src/lib/bpm/cadencias/agendar-reuniao.ts` — calendário e passos da etapa.
- `src/lib/bpm/cadencias/ativacao-automatica.ts` — ativação da cadência.
- `src/lib/bpm/automacao-novos-leads.ts` — processamento compartilhado da automação.
- `src/components/bpm/cadencias/CadenciaFormDialog.tsx` — edição da cadência.
- `tests/bpm/atribuir-lead-agendar-modal.test.ts` — cenário do modal.
- `tests/bpm/cadencia-agendar-reuniao.test.ts` — dias úteis, feriados e passos editados.
- `tests/bpm/automacao-reuniao-agendada.test.ts` — regressão da automação existente.

## QA Results

Gates informados pelo executor: lint 0 erros/1191 avisos, 534 arquivos e 3951 testes aprovados no `npm test`, build aprovado e typecheck repetido após build aprovado. A leitura remota confirmou a publicação persistente, inclusive matriz, formulário, cadência e integridade referencial. Cobertura focada existe para modal e cadência; isso ainda não comprova todos os cenários do AC 12, especialmente homologação autenticada do editor, edição/exclusão da cadência, Google Meet e script vazio. Deploy e revisão CodeRabbit/QA pendentes.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Pipeline, fluxo e precedência da decisão mais recente explícitos. |
| Technical Implementation Guidance | PASS | Fontes canônicas, entrypoints e limite de publicação identificados. |
| Reference Effectiveness | PASS | Story anterior e arquivos relevantes têm finalidade resumida. |
| Self-Containment Assessment | PASS | Cadência, atribuição, saídas, exceção NoLoss e limites explícitos. |
| Testing Guidance | PASS | Cenários mensuráveis de domínio, UI, automação e configuração. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos presentes. |

**Final Assessment:** configuração persistente publicada e verificada; código preparado, com deploy, homologação autenticada e revisão final pendentes. O script permanece vazio até edição do usuário.
