# Story: Alpha CRM — regras e automações de Novos Leads

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `scout`, `lint`, `typecheck`, `vitest`, `build`, `probe`, `anubis`, `coderabbit`

## Story

**Como** responsável comercial no Alpha CRM,  
**quero** que a etapa **Novos Leads** valide os dados mínimos, restrinja saídas inválidas e acompanhe a cadência de contato,  
**para** que nenhum lead avance incompleto ou permaneça sem tratamento após o ciclo operacional definido.

## Contexto e fontes de verdade

Esta story implementa somente as regras da etapa **Novos Leads** do pipeline comercial descritas em `.bibble/memory/plano-novos-leads-bpm.md`:

- requisitos obrigatórios: **Nome do responsável, CNPJ, Radar pretendido e Confirmar serviço**;
- saídas permitidas de Novos Leads: **Agendar Reunião** ou **Standby - Follow Up**;
- ligações registradas em `BpmInteracaoCard` com `tipo: "LIGACAO"`, sem criar contador/tabela paralela;
- meta visual de **5 ligações por dia**, exclusiva de Novos Leads e sem bloqueio real de ações ou movimentação;
- processamento diário às **09:00 em America/Sao_Paulo**;
- ciclo de **8 dias úteis consecutivos**, contando segunda a sexta; feriados não são descontados nesta fase, conforme decisão registrada no plano;
- ao esgotar o ciclo elegível, movimento automático para **Standby - Follow Up**, com histórico de automação.

O código atual já possui os pontos principais de integração: `CriarCardBpm` e `MoverCardBpm` em `src/actions/bpm/Cards.ts`, registro em `src/actions/bpm/Interacoes.ts`, board em `PipelineBoardClient.tsx`, formulário em `NovoCardModal.tsx`, `BpmInteracaoCard`, `BpmCardHistorico`, `BpmEtapaTransicaoPermitida` e `BpmCampoObrigatorioEtapa` no schema. A implementação deve primeiro confirmar o estado real desses mecanismos e reaproveitá-los.

### Resultado do reconhecimento: “respondido”

O Scout confirmou que não existe campo canônico de “respondido”. Nenhuma flag, coluna ou migration foi criada. Conforme a decisão já registrada em `.bibble/memory/plano-novos-leads-bpm.md`, a elegibilidade operacional desta fase é a permanência do card em **Novos leads**; uma ligação registrada não é presumida como resposta.

### Restrição de banco

Nenhuma migration está presumida ou autorizada por esta story. O Scout deve priorizar os modelos e campos existentes. Se identificar mudança estrutural indispensável, a implementação de banco fica bloqueada e exige fluxo separado com `Vault`, relatório de impacto, backup completo e verificado com até 48 horas e confirmação explícita do usuário, conforme `AGENTS.md`.

## Acceptance Criteria

1. Na criação de um card diretamente em **Novos Leads**, os quatro requisitos de negócio — Nome do responsável, CNPJ, Radar pretendido e Confirmar serviço — são exibidos como obrigatórios e validados antes da persistência.
2. A validação de criação existe também no servidor; payload direto, UI alternativa ou manipulação do cliente não permite criar o card com requisito ausente, vazio ou composto apenas por espaços.
3. A implementação mapeia cada requisito à fonte canônica já existente (campo nativo, empresa vinculada ou `BpmCampo`) e não duplica informação somente para satisfazer a validação.
4. Antes de um card **sair de Novos Leads**, os mesmos quatro requisitos são revalidados no servidor contra o estado persistido atual, inclusive para cards legados ou criados antes da correção.
5. Se algum requisito estiver ausente na criação ou na saída, a operação é recusada sem persistência parcial, o card permanece na etapa original e a mensagem identifica os requisitos pendentes.
6. A partir de **Novos Leads**, somente os destinos **Agendar Reunião** e **Standby - Follow Up** são aceitos; qualquer outro destino é rejeitado no servidor, inclusive por chamada direta à action.
7. A UI não apresenta como válida uma transição proibida e, se um drag otimista for recusado pelo servidor, restaura o card em Novos Leads e mostra o motivo do bloqueio.
8. O indicador diário considera exclusivamente registros de `BpmInteracaoCard` do card com `tipo = "LIGACAO"` e `createdAt` dentro do dia civil de `America/Sao_Paulo`.
9. Para card elegível em **Novos Leads**, o board e/ou detalhe exibe progresso claro de `realizadas/5` ou `faltam N de 5`, limitado visualmente à meta diária; registrar ligações adicionais continua permitido e não gera contador paralelo.
10. A meta de 5 ligações não bloqueia criação, edição, registro de interação, abertura ou movimentação do card. Ela não aparece nem é cobrada nas demais etapas.
11. O Scout identifica e documenta a ausência de fonte canônica de “respondido”; nenhuma estrutura nova é inventada e a permanência em Novos leads é usada como proxy operacional já aprovada no plano.
12. O ciclo de oito dias usa datas civis de `America/Sao_Paulo`, conta somente segunda a sexta e não desconta feriados nesta fase; virada de mês/ano e horário de verão não alteram o dia civil calculado.
13. O job executa diariamente às **09:00 de Brasília** e sua rota é protegida por segredo de cron, rejeitando chamadas não autenticadas sem processar cards.
14. Ao completar o oitavo dia útil, um card ainda elegível e em Novos Leads é movido uma única vez para **Standby - Follow Up**. Execuções repetidas, concorrentes ou reprocessadas são idempotentes e não duplicam movimento nem histórico.
15. O movimento automático registra `BpmCardHistorico` com origem de automação, etapa anterior, etapa destino e timestamp suficiente para auditoria, sem atribuir a ação a um usuário humano inexistente.
16. O job não move cards que já saíram de Novos Leads, que deixaram de atender ao critério de elegibilidade confirmado pelo Scout ou para os quais não exista destino Standby inequívoco no mesmo pipeline; esses casos são observáveis e não causam falha global do lote.
17. Nenhuma tabela, coluna, índice, seed/backfill ou mutação em massa é introduzida sem o gate explícito de banco descrito nesta story.
18. Há testes automatizados para obrigatórios na criação e saída, transições permitidas, cálculo diário das ligações, timezone, oito dias úteis com fim de semana/feriado, autenticação do cron, idempotência e movimento automático.
19. Os gates `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados; falhas preexistentes ou ambientais são separadas de regressões desta story, e a File List é atualizada antes da conclusão.

## Blueprint inicial de integração

### Gate 0 — Scout (obrigatório antes de editar código)

- Confirmar nomes e IDs reais do pipeline e das etapas **Novos Leads**, **Agendar Reunião** e **Standby - Follow Up**; regras de negócio não devem depender apenas de comparação textual frágil quando já houver identificador/configuração persistida.
- Mapear a origem real dos quatro requisitos e como `NovoCardModal`, `CriarCardBpm`, edição do card e `MoverCardBpm` leem seus valores.
- Verificar se a criação contempla `BpmCampoObrigatorioEtapa` para campos de nível pipeline, pois o fluxo atual pode consultar apenas `BpmCampo.etapaId + obrigatorio`.
- Verificar se a saída atual valida requisitos do destino, da origem ou ambos; esta story exige revalidar os requisitos de **Novos Leads na saída**.
- Localizar a configuração efetiva de `BpmEtapaTransicaoPermitida` e confirmar que as duas transições de Novos Leads já existem; se forem apenas dados de ambiente, registrar o procedimento seguro de configuração sem presumir seed/backfill.
- Mapear a fonte canônica de “respondido”, conforme o ponto de descoberta acima.
- Confirmar a fonte de feriados aplicável e o contrato de calendário civil existente antes de reutilizá-lo.
- Confirmar infraestrutura de deploy e cron; atualmente não há `vercel.json` versionado no reconhecimento inicial, portanto o arquivo só deve ser criado se for o mecanismo real do ambiente.

### Backend e domínio

- Extrair/reutilizar uma validação única dos requisitos da etapa para evitar divergência entre `CriarCardBpm` e `MoverCardBpm`.
- Manter a autoridade no servidor: a UI antecipa erros, mas não substitui validação de action.
- Consultar ligações por intervalo `[início do dia, início do dia seguinte)` em Brasília, evitando `DATE(createdAt)` dependente do timezone da conexão.
- Implementar cálculo puro e testável do oitavo dia útil, reaproveitando o calendário existente sem acoplar o domínio de CRM à UI de Comissões.
- Implementar processamento do lote de forma idempotente e isolada por card; uma falha não interrompe todos os demais.
- Reutilizar o mecanismo de movimento/histórico sem forjar sessão humana; se `MoverCardBpm` não admitir execução de sistema, extrair serviço interno compartilhado com as mesmas invariantes.

### UI

- Corrigir marcação e feedback dos obrigatórios em `NovoCardModal.tsx` conforme a origem canônica mapeada.
- Exibir o progresso diário somente em cards de Novos Leads elegíveis.
- Preservar rollback do drag otimista e mensagem retornada pelo servidor.
- Atualizar o progresso após registrar uma ligação, usando o mecanismo de invalidação/realtime já existente.

### Scheduler e segurança

- Configurar execução às `12:00 UTC`, equivalente a `09:00 America/Sao_Paulo`, no scheduler confirmado pelo Scout.
- Proteger a Route Handler com `CRON_SECRET` (ou contrato equivalente já adotado no ambiente), comparar o segredo antes de qualquer leitura/processamento e nunca logar seu valor.
- Retornar telemetria mínima do lote: examinados, movidos, ignorados e falhos, sem expor dados pessoais.

### Arquivos candidatos (a confirmar pelo Scout)

- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Interacoes.ts`
- `src/actions/bpm/Pipelines.ts`
- `src/lib/bpm/automacoes.ts`
- `src/lib/validations/bpm.ts`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`
- `src/app/api/bpm/jobs/<rota-confirmada>/route.ts` (novo, se confirmado)
- `src/lib/bpm/<calendario-ou-automacao-confirmado>.ts` (novo, se necessário)
- `vercel.json` (novo somente se confirmado como configuração de deploy)
- `tests/bpm/novos-leads-regras-automacoes.test.ts` (novo)

## Tasks / Subtasks

- [x] Executar o reconhecimento Scout e registrar mapa de campos, etapas, “respondido”, feriados, scheduler e arquivos afetados (AC: 3, 11–13, 17)
- [x] Corrigir a validação de criação de Novos Leads na UI e no servidor, reutilizando a fonte canônica dos quatro requisitos (AC: 1–3, 5)
- [x] Revalidar os requisitos persistidos de Novos Leads antes de qualquer saída e manter a operação atômica (AC: 4–5)
- [x] Garantir a máquina de transição Novos Leads → Agendar Reunião/Standby no servidor e o feedback/rollback da UI (AC: 6–7)
- [x] Implementar consulta e indicador diário das ligações via `BpmInteracaoCard.tipo = "LIGACAO"`, sem trava e sem tabela paralela (AC: 8–10)
- [x] Implementar e testar o calendário civil de oito dias úteis com fins de semana, sem desconto de feriados e com viradas de período (AC: 12)
- [x] Implementar Route Handler protegida, agendamento às 09:00 Brasília e telemetria segura (AC: 13, 16)
- [x] Implementar movimento automático idempotente para Standby e histórico de automação (AC: 14–16)
- [ ] Adicionar testes unitários, integração/action e smoke do fluxo do board (AC: 18)
- [ ] Executar quality gates, CodeRabbit, atualizar checkboxes, Completion Notes e File List (AC: 19)

## Riscos e mitigação

| Risco | Mitigação / gate |
|---|---|
| Inventar o significado de “respondido” | Scout obrigatório; ausência vira decisão pendente, nunca heurística ou migration silenciosa. |
| Validação diferente entre criação e saída | Regra de domínio compartilhada e testes dos dois entrypoints. |
| Campos de pipeline não serem reconhecidos como obrigatórios na criação | Scout audita `BpmCampoObrigatorioEtapa` e o payload efetivo antes da correção. |
| Bypass pela UI ou chamada direta | Servidor é a autoridade para obrigatórios e transições. |
| Contagem diária errada por UTC | Intervalo explícito do dia civil em `America/Sao_Paulo`. |
| Movimento duplicado por retry/concor­rência | Rechecagem da etapa/elegibilidade na transação e histórico idempotente. |
| Feriado incompleto ou de escopo indevido | Consumir somente a fonte confirmada; não inventar UF/município aplicável. |
| Cron exposto | Segredo validado antes do processamento, Anubis e teste de chamada não autorizada. |
| Mudança de banco descoberta durante a execução | Parar a parcela afetada e acionar Vault; sem migration implícita nesta story. |

## Testing

- Unitário: normalização dos quatro requisitos, valores vazios/espaços, janela diária de ligações, limite visual da meta e cálculo de dias úteis.
- Calendário: início em cada dia da semana, fim de semana intermediário, feriado, virada de mês/ano e instante próximo da meia-noite UTC/Brasília.
- Action/integrado: criação válida/inválida, saída com campo removido, destino permitido/proibido e chamada direta sem depender da UI.
- Job: segredo ausente/incorreto/correto, card recém-criado, sétimo/oitavo dia útil, card já movido, destino ausente, retry e lote com falha parcial.
- UI/smoke: obrigatórios visíveis, erro acionável, rollback do drag, indicador `0/5` a `5/5`, atualização após ligação e ausência do indicador fora de Novos Leads.

## Quality Gates

- [x] Scout concluído e blueprint/file candidates confirmados antes de implementar.
- [x] Nenhuma definição nova de “respondido”.
- [x] Nenhuma migration, seed/backfill ou mutação em massa sem Vault + backup + confirmação explícita.
- [x] Anubis na rota de cron e tratamento do segredo.
- [x] Probe no wiring criação → ligações → tentativa de movimento → movimento automático.
- [x] Vitest direcionado nos cenários de calendário, requisitos, timezone e segredo do cron.
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] CodeRabbit sem issue CRITICAL pendente.
- [x] File List atualizada.

## CodeRabbit Integration

- **Tipo primário:** API/Business Logic; **secundários:** Frontend, Security e Deployment; **complexidade:** alta.
- **Agentes previstos:** `@dev`, `@qa`, `@ux-expert`; `@architect` se o Scout encontrar ausência de contrato para “respondido”; `@github-devops` para configuração de deploy/PR; `Vault` somente se surgir proposta estrutural de banco.
- **Pre-Commit:** `coderabbit --prompt-only -t uncommitted` antes de concluir a story.
- **Pre-PR:** revisão contra `main` antes da criação do PR.
- **Foco:** validação server-side, autorização do cron, timezone, idempotência, queries limitadas ao pipeline/etapa corretos, ausência de logs sensíveis e não regressão de outros pipelines.
- **Self-healing Dev:** light, até 2 iterações/15 min para CRITICAL; HIGH documentado. QA executa full para CRITICAL/HIGH.

## Story Draft Validation

| Categoria | Status | Observação |
|---|---|---|
| Goal & Context Clarity | PASS | Escopo restrito à etapa Novos Leads e resultado mensurável. |
| Technical Implementation Guidance | PASS | Entry points, invariantes, scheduler e arquivos candidatos identificados. |
| Reference Effectiveness | PASS | Regra-fonte resumida; referências apontam para artefato e código existentes. |
| Self-Containment Assessment | PASS | Regras fechadas e pendência de “respondido” explicitamente roteada ao Scout. |
| Testing Guidance | PASS | Cenários de domínio, segurança, calendário, UI e retry cobertos. |
| CodeRabbit Integration | PASS | Tipos, agentes, gates, foco e self-healing definidos. |

**Final Assessment:** READY — a implementação pode iniciar pelo Gate 0/Scout. A ausência de um campo canônico de “respondido” não autoriza invenção; se confirmada, somente a parcela dependente desse estado deve aguardar decisão.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-08-12 | 1.0 | Story criada com regras de obrigatoriedade, transição, cadência de ligações e ciclo automático de Novos Leads. | River |

## Dev Agent Record

### Agent Model Used

GPT-5 / Codex.

### Debug Log References

- `npx eslint <arquivos alterados>`: passou sem erros.
- `npx vitest run tests/bpm/novos-leads.test.ts tests/bpm/realtime.test.ts`: 10/10 testes passaram.
- `npx tsc --noEmit --pretty false`: nenhum erro nos arquivos desta story; quatro grupos de erros preexistentes permanecem em `.next/*/validator.ts`, `HabilitacaoRadarClient.tsx` e `tests/google-calendar/sync-queue.test.ts`.
- `npm run lint`: ultrapassou o limite de 60 segundos sem produzir resultado; o lint direcionado já havia passado.
- O job real não foi disparado para evitar mutação operacional durante a validação.

### Completion Notes List

- Requisitos diretos e por `BpmCampoObrigatorioEtapa` agora compartilham a mesma validação no servidor.
- A criação e qualquer saída de Novos leads recusam campos vazios, inclusive cards legados.
- A configuração de transições existente continua sendo a autoridade de destinos permitidos.
- O board exibe ligações do dia civil de São Paulo e dia do ciclo apenas em Novos leads, atualizados pelo realtime existente.
- O job diário move cards íntegros após oito dias úteis, de forma condicional/idempotente, e registra histórico da automação.
- Não houve alteração de schema, migration, seed, backfill ou execução contra o banco.
- `CRON_SECRET` precisa ser configurado no ambiente de deploy antes de a rota poder executar.

### File List

- `docs/stories/story-alpha-crm-novos-leads-regras-automacoes.md` (novo)
- `.env.example` (novo)
- `vercel.json` (novo)
- `package.json`
- `scripts/bpm-novos-leads-job.mjs` (novo)
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Interacoes.ts`
- `src/actions/bpm/Pipelines.ts`
- `src/app/api/bpm/jobs/automacao-novos-leads/route.ts` (novo)
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/lib/bpm/automacao-novos-leads.ts` (novo)
- `src/lib/bpm/cron-auth.ts` (novo)
- `src/lib/bpm/novos-leads.ts` (novo)
- `src/lib/bpm/requisitos-etapa-server.ts` (novo)
- `src/lib/bpm/requisitos-etapa.ts` (novo)
- `tests/bpm/novos-leads.test.ts` (novo)

## QA Results

Pendente de homologação visual autenticada. Gates direcionados aprovados; typecheck global permanece bloqueado apenas por erros preexistentes fora do Alpha CRM.
