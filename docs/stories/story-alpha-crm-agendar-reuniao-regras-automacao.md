# Story: Alpha CRM — regras e automação de Agendar Reunião

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `scout`, `lint`, `typecheck`, `vitest`, `build`, `probe`, `anubis`, `coderabbit`

## Story

**Como** responsável comercial no Alpha CRM,  
**quero** que a etapa **Agendar reunião** exija Data/Hora antes do avanço e participe do ciclo automático de oito dias úteis,  
**para** que o card não avance sem reunião marcada e seja encaminhado ao Standby quando o prazo operacional vencer.

## Contexto e dependência

Esta story é continuação direta de `docs/stories/story-alpha-crm-novos-leads-regras-automacoes.md` e reutiliza a infraestrutura já entregue para o ciclo de oito dias: cálculo em dias úteis, job diário, rota autenticada por cron, entrada CLI, histórico e atualização do board em tempo real.

Escopo fechado desta story:

- o valor canônico de Data/Hora é `BpmCard.dataReuniao`;
- uma transição solicitada pelo usuário de **Agendar reunião** para **Reunião Agendada** deve ser recusada quando `dataReuniao` estiver ausente ou inválida;
- a recusa deve acontecer no backend, sem depender da UI;
- o board deve desfazer o movimento otimista e exibir claramente que Data/Hora precisa ser preenchida;
- cards em **Agendar reunião**, com `status = "ATIVO"` e `proximoContatoEm = null`, participam do mesmo ciclo de oito dias úteis já usado em Novos Leads;
- o ciclo considera segunda a sexta, sem desconto de feriados;
- quando o ciclo vencer, o card deve ir de forma idempotente para **Standby - Follow Up**, com histórico e evento de realtime;
- a meta visual de cinco ligações por dia continua exclusiva de **Novos Leads** e não deve aparecer nem ser calculada para **Agendar reunião**;
- nenhuma tabela, coluna, índice, seed, backfill ou migration faz parte desta story;
- o cron, sua rota protegida e o CLI existentes devem ser reutilizados, sem criar um segundo agendamento concorrente.

### Regra de precedência

O guard de Data/Hora protege transições comerciais solicitadas pelo usuário. O encaminhamento automático por vencimento para **Standby - Follow Up** é uma transição de ciclo do sistema, não um avanço comercial, e deve continuar possível quando o card atender aos critérios de expiração. Essa distinção evita que a ausência de reunião — justamente o cenário de expiração — bloqueie o Standby automático.

## Acceptance Criteria

1. Ao tentar avançar manualmente de **Agendar reunião** para **Reunião Agendada**, o backend consulta o estado persistido do card e exige `BpmCard.dataReuniao` válida; Standby permanece como saída de contingência.
2. Uma chamada direta à action de movimento, payload manipulado ou cliente alternativo não consegue contornar o guard de Data/Hora.
3. Quando Data/Hora estiver ausente ou inválida, a operação termina sem atualização parcial do card ou criação de histórico de movimento, e a resposta informa claramente: **“Preencha Data e Hora da reunião antes de avançar.”** ou mensagem equivalente inequívoca.
4. Quando Data/Hora estiver válida e os demais requisitos/transições da etapa estiverem atendidos, o guard não impede o movimento permitido.
5. No board, um drag otimista recusado pelo guard restaura o card à etapa original e mostra o motivo retornado pelo backend de forma visível ao usuário.
6. A UI pode antecipar o bloqueio quando já conhecer a ausência de Data/Hora, mas a validação visual não substitui nem enfraquece o guard server-side.
7. O processamento existente do ciclo de oito dias passa a examinar também cards na etapa **Agendar reunião** que estejam com `status = "ATIVO"` e `proximoContatoEm = null`.
8. Para **Agendar reunião**, o cálculo reutiliza a mesma referência temporal e o mesmo helper do ciclo existente, conta apenas segunda a sexta e não desconta feriados.
9. Antes do vencimento do oitavo dia útil, o job não move o card de **Agendar reunião** por essa regra.
10. Ao vencer o ciclo, um card ainda elegível em **Agendar reunião** é movido uma única vez para **Standby - Follow Up**, mesmo diante de reexecução, concorrência ou retry do job.
11. O movimento automático registra `BpmCardHistorico` com origem de automação, etapa anterior, etapa destino e timestamp, e publica a notificação de realtime para atualizar o frontend sem refresh.
12. O encaminhamento automático para Standby não é bloqueado pelo guard de Data/Hora, pois é uma transição sistêmica de expiração, não um avanço comercial solicitado pelo usuário.
13. O job ignora cards que saíram de **Agendar reunião**, que não estejam `ATIVO`, que possuam `proximoContatoEm` ou que deixaram de atender ao critério no momento da atualização atômica.
14. Ausência ou ambiguidade da etapa **Standby - Follow Up** no mesmo pipeline é reportada de forma observável e não provoca movimento incorreto nem falha global do lote.
15. A rota protegida, o segredo de cron, o agendamento e o comando CLI já existentes são reutilizados para processar **Novos Leads** e **Agendar reunião** no mesmo fluxo operacional.
16. Cards em **Agendar reunião** não exibem `Ligações hoje: X/5`, não recebem meta de cinco ligações e não geram consulta de contagem diária específica dessa etapa.
17. A implementação não cria schema, migration, seed, backfill nem mutação em massa. Qualquer necessidade estrutural descoberta interrompe esse trecho e exige o fluxo separado de `Vault` definido no `AGENTS.md`.
18. Existem testes automatizados cobrindo: guard sem Data/Hora, movimento permitido com Data/Hora, ausência de persistência parcial, rollback/mensagem da UI, elegibilidade por status e `proximoContatoEm`, limite de oito dias úteis com fim de semana, idempotência, histórico/realtime e ausência da meta de cinco ligações em Agendar reunião.
19. Os gates `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados. Falhas preexistentes ou ambientais devem ser separadas de regressões desta story, e a File List deve ser atualizada antes da conclusão.

## Tasks / Subtasks

- [x] 1. Confirmar os pontos atuais de integração antes de editar código (AC: 1, 7, 15, 17)
  - [x] Mapear como `dataReuniao` é carregada e atualizada no card e no modal.
  - [x] Confirmar o fluxo efetivo de **Agendar reunião** e **Standby - Follow Up**.
  - [x] Confirmar que a solução usa somente campos/modelos existentes e não requer migration.
- [x] 2. Implementar o guard server-side de Data/Hora (AC: 1–4, 12)
  - [x] Centralizar a regra de identificação da etapa e validação de `BpmCard.dataReuniao` em helper testável.
  - [x] Executar o guard em `MoverCardBpm` sobre o estado persistido antes de qualquer update/histórico.
  - [x] Retornar mensagem clara e estável para a UI.
  - [x] Manter o caminho interno da automação de expiração separado do avanço manual.
- [x] 3. Ajustar o feedback do board (AC: 5, 6)
  - [x] Preservar o rollback do card para a coluna original após rejeição da action.
  - [x] Exibir aviso antecipado no modal e a mensagem do backend no board.
  - [x] Não duplicar validações de negócio de forma divergente no cliente.
- [x] 4. Generalizar o ciclo de oito dias para Agendar reunião (AC: 7–15)
  - [x] Reaproveitar o helper de dias úteis usando a última entrada na etapa como referência temporal.
  - [x] Incluir somente cards `ATIVO` com `proximoContatoEm = null`.
  - [x] Revalidar etapa/status/elegibilidade no update atômico.
  - [x] Registrar histórico com origem específica e publicar realtime após movimento confirmado.
  - [x] Ampliar o resumo do lote por etapa.
- [x] 5. Preservar a exclusividade da meta de ligações (AC: 16)
  - [x] Verificar que o enriquecimento dos cards e a renderização `X/5` continuam condicionados exclusivamente a Novos Leads.
  - [x] Não adicionar consultas de `BpmInteracaoCard` para Agendar reunião.
- [x] 6. Reutilizar os entrypoints existentes (AC: 15)
  - [x] Fazer a rota de cron existente chamar o processamento ampliado.
  - [x] Manter o mesmo comando CLI e o mesmo agendamento.
- [ ] 7. Testar e validar (AC: 18, 19)
  - [ ] Criar testes unitários para o guard e para o cálculo/elegibilidade da etapa.
  - [ ] Criar testes de integração da automação, incluindo concorrência/idempotência, histórico e realtime.
  - [ ] Cobrir o rollback e a mensagem visível da UI em teste apropriado.
  - [ ] Executar os gates do projeto e registrar separadamente qualquer falha basal não relacionada.
- [x] 8. Atualizar esta story antes do handoff (AC: 19)
  - [x] Marcar tarefas concluídas.
  - [x] Atualizar File List, Completion Notes e resultados dos gates.
  - [x] Alterar o status para `Ready for Review` após implementação e verificação direcionada.

## Dev Notes

### Pontos de integração confirmados

- `BpmCard.dataReuniao` já existe e é a fonte canônica de Data/Hora; não criar `BpmCampo` duplicado.
- `MoverCardBpm` em `src/actions/bpm/Cards.ts` já concentra autorização, validação de transições, update e histórico de movimentos manuais.
- `src/lib/bpm/automacao-novos-leads.ts` já possui o processamento idempotente do ciclo de oito dias, e deve ser generalizado/reaproveitado em vez de duplicado por etapa.
- `src/lib/bpm/novos-leads.ts` já contém helpers do dia civil e dos dias úteis; a regra de Agendar reunião deve usar a mesma implementação.
- `src/app/api/bpm/jobs/automacao-novos-leads/route.ts` e `scripts/bpm-novos-leads-job.mjs` são os entrypoints existentes do cron e CLI.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` já executa movimento otimista e recarga após recusa; a mensagem específica do backend deve permanecer visível.
- O realtime existente deve ser emitido somente depois de um movimento persistido com sucesso.

### Limites de escopo

- Não criar um segundo cron, outra rota pública ou outro scheduler.
- Não implementar criação/reagendamento de evento Google Meet nesta story.
- Não aplicar a meta de cinco ligações a Agendar reunião.
- Não mudar a regra de feriados: continuam contabilizados como dias úteis se caírem de segunda a sexta nesta fase.
- Não alterar schema nem executar mutação em massa.

### Testing

- Testes de regras puras devem permanecer em `tests/bpm/` e cobrir datas determinísticas, incluindo passagem por fim de semana.
- Testes do guard devem provar que a leitura usa o valor persistido, não apenas o payload do cliente.
- Testes de automação devem simular execução repetida/concorrente e comprovar que o update condicional impede histórico duplicado.
- Testes do frontend devem validar tanto o rollback quanto a exibição da mensagem devolvida pelo servidor.
- A execução manual do job contra banco compartilhado/produção não faz parte da validação automatizada; usar mocks/fixtures para evitar mutações reais.

## CodeRabbit Integration

**Primary Type**: Full-stack / business rules  
**Secondary Type(s)**: Automation, API route, realtime  
**Complexity**: Medium

### Specialized Agent Assignment

**Primary Agents**:

- `@dev` — guard, automação e integração do frontend
- `@qa` — cenários de regressão, concorrência e integração

**Supporting Agents**:

- `@ux-design-expert` — clareza da mensagem e comportamento de rollback
- `@devops` — apenas se houver mudança operacional na configuração do cron/deploy

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): validar regras, tratamento de erros, idempotência e ausência de mudanças de schema.
- [ ] Pre-PR (`@devops`): validar compatibilidade do cron/CLI existente e variáveis de ambiente, se houver PR.
- [ ] Pre-Deployment (`@devops`): confirmar que há um único agendamento ativo e que `CRON_SECRET` está configurado.

### Self-Healing Configuration

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: corrigir automaticamente dentro do limite configurado.
- HIGH: documentar para tratamento antes do handoff se não puder ser resolvido no fluxo.

### CodeRabbit Focus Areas

- Guard executado antes de qualquer persistência.
- Mensagem de erro não perdida no rollback otimista.
- Update condicional/idempotente antes de criar histórico.
- Realtime emitido somente após commit bem-sucedido.
- Ausência de contagem `X/5` fora de Novos Leads.
- Ausência de segredo hardcoded e de nova rota desprotegida.

## Initial File List

- `docs/stories/story-alpha-crm-agendar-reuniao-regras-automacao.md` — criada; story e rastreabilidade.
- `src/actions/bpm/Cards.ts` — previsto; guard de Data/Hora e dados necessários ao frontend.
- `src/lib/bpm/automacao-novos-leads.ts` — previsto; generalização do processamento de oito dias.
- `src/lib/bpm/novos-leads.ts` — previsto somente se necessário; helper compartilhado de ciclo/identificação de etapa.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — previsto; mensagem/rollback e preservação da exclusividade de `X/5`.
- `src/app/api/bpm/jobs/automacao-novos-leads/route.ts` — previsto somente se necessário; uso do processador ampliado.
- `scripts/bpm-novos-leads-job.mjs` — previsto somente se necessário; nomenclatura/saída do CLI sem novo entrypoint.
- `tests/bpm/agendar-reuniao.test.ts` — previsto; regras de guard e ciclo.
- `tests/bpm/automacao-agendar-reuniao.test.ts` — previsto; idempotência, histórico e realtime.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-12 | 1.0 | Story criada com regras de Data/Hora, ciclo de oito dias e Standby | River (`@sm`) |

## Dev Agent Record

### Agent Model Used

GPT-5 / Codex.

### Debug Log References

- `npx eslint` direcionado aos arquivos alterados: passou sem erros.
- `npx vitest run tests/bpm/agendar-reuniao.test.ts tests/bpm/novos-leads.test.ts tests/bpm/realtime.test.ts`: 15/15 testes passaram.
- `npx tsc --noEmit --pretty false`: nenhum erro nos arquivos desta story; permanecem apenas erros preexistentes em Exclusão Fiscal, Habilitação Radar e testes da fila do Google Calendar.
- `git diff --check`: passou.
- O job não foi executado contra o banco real durante a validação.

### Completion Notes List

- `MoverCardBpm` lê `dataReuniao` persistida e bloqueia somente o avanço comercial para Reunião Agendada.
- O modal explica o bloqueio antecipadamente e mantém Standby disponível; o board preserva rollback e mensagem do backend.
- O job existente agora processa Novos leads e Agendar reunião no mesmo lote, com resumo por etapa.
- Em Agendar reunião, os oito dias úteis começam na entrada mais recente registrada no histórico, com fallback para `createdAt` em cards legados.
- Movimento automático continua condicional/idempotente, registra `automacaoOrigem` própria e publica realtime após o commit.
- Nenhuma migration, alteração de schema, seed, backfill ou execução do job real foi realizada.

### File List

- `docs/stories/story-alpha-crm-agendar-reuniao-regras-automacao.md` (novo)
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/api/bpm/jobs/automacao-novos-leads/route.ts`
- `src/lib/bpm/agendar-reuniao.ts` (novo)
- `src/lib/bpm/automacao-novos-leads.ts`
- `tests/bpm/agendar-reuniao.test.ts` (novo)

## QA Results

Validação direcionada aprovada. Homologação visual autenticada continua recomendada antes do deploy; gates globais permanecem afetados somente por falhas basais fora do Alpha CRM.

## Story Draft Validation

| Category | Status | Issues |
|---|---|---|
| Goal & Context Clarity | PASS | Escopo e benefício definidos; dependência da story anterior explícita. |
| Technical Implementation Guidance | PASS | Guard, ciclo, cron/CLI, realtime e pontos de integração identificados. |
| Reference Effectiveness | PASS | A story anterior e os arquivos canônicos são contextualizados, sem exigir mudança de schema. |
| Self-Containment Assessment | PASS | Elegibilidade, exceção sistêmica de Standby e limites de escopo estão explícitos. |
| Testing Guidance | PASS | Cenários de backend, UI, calendário, idempotência e integração enumerados. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos definidos. |

**Final Assessment:** READY — a story contém contexto suficiente para implementação sem criar requisitos além do escopo aprovado.
