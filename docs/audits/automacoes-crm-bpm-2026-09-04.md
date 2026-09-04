# Auditoria completa de automações do CRM/BPM — 2026-09-04

## Escopo e método

Foram auditados `prisma/schema.prisma`, todas as migrations, `vercel.json`,
scripts operacionais, Server Actions BPM, bibliotecas de domínio, rotas `/api/bpm`,
componentes do Alpha CRM e o banco configurado em modo somente leitura. A busca
incluiu automações, jobs, crons, agendas, filas, eventos, webhooks, mutações de
card/campo/tarefa e marcadores `automacaoOrigem`.

## Inventário executável

| Automação/comportamento | Implementação encontrada | Gatilho e escopo | Efeito | Idempotência atual | Destino da migração |
|---|---|---|---|---|---|
| Motor legado configurável | `BpmAutomacao`, `fila.ts`, `executor.ts` | criação/movimento/tarefa/deferimento/tempo | e-mail, contrato, ficha, checklist, distribuição, oportunidade | `(automacaoId, eventoChave)` | gerar versão central e impedir fila legada quando houver versão ativa |
| Motor central | `BpmAutomacaoVersao`, outbox, agenda e `central-runtime.ts` | eventos canônicos, tempo, recorrência, webhook e SLA | grafo de condições/ações/esperas | versão+evento, correlation e lease | fonte oficial única |
| Fechamento comercial | `src/lib/bpm/automacoes.ts` | entrada em Fechado, fora de Financeiro/Radar | cria cards vinculados em Financeiro e Radar | um card ativo por empresa/pipeline | duas ações configuradas no grafo central |
| Nota Fiscal | `src/lib/bpm/automacoes.ts` | entrada em Nota Fiscal do Financeiro | cria tarefa `EMISSAO_NF` alta | não cria se houver pendente | ação central `CRIAR_TAREFA` com trava por tipo |
| Expiração de funil | `automacao-novos-leads.ts` | oito dias úteis em Novos leads, Agendar reunião ou Reunião Agendada, sem próximo contato | move para Standby; Novos leads respeita requisitos | CAS por etapa/estado | gatilho temporal central + condição + `MOVER_CARD` |
| Ligações de Novos Leads | `automacao-novos-leads.ts` | diária, durante ciclo de oito dias úteis | completa até cinco tarefas de ligação no dia | histórico por card/dia + CAS | recorrência central + ação genérica de meta diária |
| Follow-up Standby | `automacao-novos-leads.ts` | sete dias desde entrada/último ciclo, enquanto não interrompido | tarefa de ligação semanal | CAS em `standbyFollowUpUltimoEm` | recorrência por card + tarefa central |
| Monitoramento | `automacao-novos-leads.ts` | trinta dias desde entrada/última revisão | tarefa de revisão | histórico por ciclo + CAS | recorrência por card + tarefa central |
| Alerta de tarefa | `alertas-tarefas.ts` e cron próprio | `alertaEm <= agora` | marca alerta e registra histórico | CAS em `alertaDisparadoEm` | evento temporal + ação central de alerta |
| Cadências | models `BpmCadencia*`, admin próprio e `cadencias/executor.ts` | vínculo manual e passos vencidos | cria tarefas sequenciais | `(vinculoId, passoId, chaveEvento)` | converter passos em grafo central com esperas; novas cadências nascem como automações |
| SLA | models `BpmSla*` e `sla.ts` | cinco momentos e mudanças de status | prazo, pausa, disparo e outbox | instância/disparo/evento únicos | já publica `SLA_STATUS_ALTERADO`; projetar configurações e versões relacionadas na central |
| Polling Google Meet | `transcricao-reuniao-server.ts` no cron de follow-up | reunião passada nas etapas elegíveis, transcrição vazia | sincroniza transcrição no card | comparação/CAS e lock em processo | recorrência central + conector configurado |
| Webhooks | `BpmWebhookEndpoint/Entrada` e `/api/bpm/webhooks/[slug]` | HTTP autenticado e idempotente | publica outbox | endpoint+idempotency key | já central; exibir junto da definição |
| Regras financeiras | guarda transacional de movimento | movimento do pipeline Financeiro | calcula/persiste campos e comissão | transação e chaves do domínio | classificada como invariante de negócio, não automação editável; fica observável como regra vinculada |
| Guardas de transição/checklists | `Cards.ts`, requisitos e checklists | tentativa de movimento | valida/bloqueia/materializa dados necessários | transação do movimento | invariante/validação, não execução autônoma |

## Infraestrutura encontrada

- Crons BPM: `/api/bpm/jobs/automacoes` a cada cinco minutos,
  `/api/bpm/jobs/automacao-novos-leads` diariamente às 12:00 UTC e
  `/api/bpm/jobs/alertas-tarefas` a cada cinco minutos.
- CLI: `bpm:automacoes` e `bpm:cadencias`.
- Filas: `BpmAutomacaoExecucao`, outbox `BpmEventoDominio`,
  `BpmAutomacaoAgenda`, leases e a fila própria de cadências.
- Listeners/produtores: Cards, Tarefas, Membros, Vínculos, SLA e webhook.
- Trigger SQL: nenhum encontrado.
- Listeners apenas visuais (`setInterval` de refresh e realtime) não executam
  mutações de negócio e não são automações cadastráveis.

## Falhas arquiteturais confirmadas

1. A página monta `MotorCentralPanel` e `AutomacoesWorkspace`, com dois editores.
2. Criar/editar no editor amigável altera somente `BpmAutomacao`; versões centrais
   são criadas separadamente por JSON.
3. O cron processa motor central, motor legado, cadências e jobs hardcoded.
4. A relação obrigatória com uma única etapa impede representar global/múltiplas
   etapas na UI, embora o JSON versionado possa carregar esse escopo.
5. O Kanban não projeta as definições que atuam em cada coluna.
6. Em produção, as rotinas hardcoded executam mesmo com zero definições visíveis.

## Regra de migração

A ordem segura é: criar representação central inativa ou versionada, validar a
equivalência em banco isolado, ativar a versão, fazer o executor antigo ignorar a
definição migrada e somente então retirar a chamada hardcoded. Histórico nunca é
apagado e execuções antigas continuam ligadas à definição estável.
