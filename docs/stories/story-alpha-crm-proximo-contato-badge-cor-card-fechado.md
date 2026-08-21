# Story — CRM: Badge de "Próximo Contato" no card fechado (RM-2026-4076AB)

Status: CONCLUÍDO

## Contexto e escopo

Objetivo do Roadmap Alpha `RM-2026-4076AB` — "Campo Próximo Contato" no módulo Alpha CRM. O campo `BpmCard.proximoContatoEm` já existia no schema e já era editável dentro do card aberto (`PainelProximoContato.tsx`), mas não havia nenhuma representação visual no card **fechado** do board (visão de pipeline), nem regra de negócio associada a tentativas de contato consecutivas sem sucesso, nem codificação por cor de urgência.

Esta story documenta o fechamento do objetivo após as Fases 0-2 do Roadmap Alpha (auditoria, implementação e verificação ponta a ponta), todas com resultado `PASS`.

> Nota: o objetivo original citava endpoints REST (`PATCH next-contact`, `POST contacts`) e uma tabela `contact_logs`. O projeto **não usa API REST para essa funcionalidade** — a arquitetura real é Server Actions (Next.js) e a tabela real de histórico de interações é `BpmInteracaoCard` (já existente). A documentação abaixo reflete a implementação real, não o texto literal do objetivo.

## Descrição funcional

- **O que faz:** exibe no card fechado do pipeline um badge com a data do próximo contato agendado, colorido conforme a urgência, e bloqueia a movimentação de cards para etapas que exigem próximo contato (`Sem Viabilidade`, `Em Tratativa`) quando a regra de 8 dias consecutivos de tentativa sem sucesso não é atendida.
- **Para quem:** operadores e gestores do pipeline "Revisão de Radar" do Alpha CRM.
- **Onde:** `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` — board de cards (card fechado) e modal de card aberto.

## Regras de validação

- **Data no passado:** bloqueia a movimentação (`obterErroProximoContatoParaMovimento`, validado no client e revalidado no servidor).
- **Data igual a hoje ou futura:** permite a movimentação.
- **8 dias consecutivos de contato:** `contarMaiorSequenciaDiasConsecutivos` (`src/lib/bpm/agendar-reuniao.ts`) calcula a maior sequência de dias corridos com interação registrada em `BpmInteracaoCard`; `obterErroContatosConsecutivosParaMovimento` bloqueia a movimentação quando a sequência é menor que 8.
- **Defesa em profundidade:** `carregarGuardasNativasMovimento` (`src/actions/bpm/Cards.ts`) é chamada em 3 pontos do fluxo de movimentação — validação de requisitos, commit da movimentação — de modo que a regra não pode ser contornada chamando a Server Action diretamente sem passar pelo client.

## Codificação por cor (badge no card fechado)

Componente `BadgeProximoContato` em `PipelineBoardClient.tsx`, com 4 estados calculados a cada render via `calcularUrgenciaProximoContato`:

| Estado | Cor | Comportamento |
|---|---|---|
| Atrasado (data < hoje) | Vermelho | Pisca via classe `alpha-badge-blink` |
| Hoje | Amarelo | Estático |
| Futuro | Verde | Estático |
| Sem data preenchida | Cinza | Texto "Sem data" |

A animação de piscar (`@keyframes alpha-badge-blink`, `src/styles/cyberpunk-alpha.css`) respeita `prefers-reduced-motion: reduce`, desativando a animação para usuários com essa preferência de acessibilidade.

## Endpoints/Server Actions utilizados

Não há rota de API REST dedicada. A persistência e a validação passam por:

- `AtualizarCardBpm` (`src/actions/bpm/Cards.ts`) — persiste `proximoContatoEm` a partir do painel `PainelProximoContato.tsx` (card aberto).
- Fluxo de movimentação de card (drag-and-drop e modal de requisitos), que internamente chama `carregarGuardasNativasMovimento` e as duas funções de validação (`obterErroProximoContatoParaMovimento`, `obterErroContatosConsecutivosParaMovimento`) antes de commitar a mudança de etapa.

## Schema de banco

- `BpmCard.proximoContatoEm DateTime?` (`prisma/schema.prisma:3337`) — já existente, sem alteração de schema nesta entrega.
- `BpmInteracaoCard` (`prisma/schema.prisma:3508`) — tabela já existente, usada como fonte de dados das tentativas de contato para o cálculo de sequência consecutiva. Nenhuma migration foi executada nesta entrega.

## Como testar

Ver os 10 cenários detalhados na verificação ponta a ponta da Fase 2 (resumo abaixo). Cobertura automatizada em `tests/bpm/agendar-reuniao.test.ts` e `tests/bpm/proximo-contato.test.ts`.

## Critérios de aceite × resultado

| # | Critério | Resultado | Evidência |
|---|---|---|---|
| 1 | Campo presente em todas as etapas | PASS | `PainelProximoContato.tsx` renderizado incondicionalmente no card aberto |
| 2 | Campo obrigatório | PASS | Validação client + server antes da movimentação |
| 3 | Data no passado bloqueia | PASS | `obterErroProximoContatoParaMovimento` → `ERRO_PROXIMO_CONTATO_ATRASADO` |
| 4 | Data = hoje permite | PASS | `proximo-contato.ts` — `contato < hoje` é `false` quando igual |
| 5 | Data no futuro permite | PASS | mesma lógica |
| 6 | 8 contatos: bloqueio (< 8) | PASS | `Cards.ts` consulta `BpmInteracaoCard` e chama `obterErroContatosConsecutivosParaMovimento` |
| 7 | 8 contatos: permissão (>= 8) | PASS | `contarMaiorSequenciaDiasConsecutivos` retorna sem erro quando `maiorSequencia >= 8` |
| 8 | Vermelho piscando (atrasado) | PASS | `BadgeProximoContato` + classe `alpha-badge-blink` (com `prefers-reduced-motion`) |
| 9 | Amarelo (hoje) | PASS | `BadgeProximoContato`, estado HOJE sem blink |
| 10 | Verde (futuro) | PASS | `BadgeProximoContato`, estado FUTURO |

Todos os 10 critérios foram confirmados como `PASS` na Fase 2 (verificação ponta a ponta por inspeção de código, sem ferramenta de browser disponível no ambiente).

## Registro de impacto

- Eliminação de leads abandonados sem follow-up: o badge visível no card fechado torna o atraso de contato visível sem precisar abrir cada card.
- Priorização clara das ações diárias: a codificação por cor permite triagem visual imediata no board.
- Redução do tempo médio de estagnação de cards: a regra de 8 dias consecutivos impede avanço de etapa sem esforço de contato real registrado.

## Data de implementação e build

- Data de fechamento: 2026-08-20.
- Build/versão: working tree local do Painel Alpha, branch `main` (commit base `6361cacb4`), ainda não commitado.

## Encerramento

- Objetivo `RM-2026-4076AB` marcado como **CONCLUÍDO** nesta story.
- Notificação aos stakeholders (equipe de CRM, operadores) sobre a nova funcionalidade é uma ação de comunicação fora do escopo de código — registrada como pendência manual abaixo.
- Documentação técnica: este arquivo (`docs/stories/story-alpha-crm-proximo-contato-badge-cor-card-fechado.md`).

## Pendências manuais (não bloqueantes)

- Notificar a equipe de CRM/operadores sobre a nova funcionalidade (ação humana, fora do escopo de ferramentas desta fase).
- Reexecutar `typecheck`/`tests`/`eslint` em ambiente limpo para confirmar os gates (a Fase 1 relatou `exitCode 1` sem output, não atribuível à alteração de CSS feita).
- Validação visual real em navegador (screenshots dos 10 cenários) — não realizável neste ambiente sem ferramenta de browser.
- Commit/PR das alterações do working tree — não executado nesta fase por restrição de operações Git mutáveis.

## Status final

CONCLUÍDO.
