# Story — Visual do modal de card do CRM

**Status:** Ready for Review
**Responsável pela preparação:** @sm
**Origem:** pedido do usuário para melhorar o card aberto após a proposta visual.

## Objetivo

Como usuário do CRM, quero um modal com mais espaço interno, superfícies discretas e abas fáceis de distinguir, para consultar e registrar informações sem poluição visual.

## Critérios de aceite

1. Preservar o card como modal que abre de baixo para cima, sem acrescentar sidebar ou cabeçalho global do aplicativo.
2. Dar respiro às bordas e aos painéis, com superfícies neutras e sem gradientes decorativos.
3. Manter as cinco abas existentes do painel de histórico: Tarefas, Procedimento, Jornada, Anexos e Histórico, com suas funções e contadores.
4. Usar uma cor suave diferente por aba. A aba ativa fica maior e destacada; as inativas ficam menores e ganham destaque ao passar o mouse ou receber foco. Respeitar preferência por movimento reduzido.
5. Manter tarefas no painel esquerdo, sem acrescentar quadro de tarefas à direita. Preservar o conteúdo funcional dos outros painéis.
6. Mostrar SLA apenas quando houver ciclo aberto de configuração ativa aplicável à etapa atual ou global. Sem ciclo aplicável, ocultar o quadro; falhas reais de consulta continuam apresentadas como erro.
7. Preservar controles de telefone, chat, pessoas, dados da empresa e permissões existentes.

## Checklist

- [x] Registrar escopo e critérios derivados do pedido.
- [x] Identificar arquivos do ajuste no diff, separando modificações anteriores de SLA e metadados.
- [x] Concluir ajustes de layout e abas.
- [x] Concluir filtro de SLA e estado vazio.
- [x] Revisar acessibilidade, movimento reduzido e preservação dos painéis.
- [x] Registrar verificações efetivamente executadas e parecer de QA.
- [x] Atualizar status e lista final antes da conclusão.

## CodeRabbit Integration

Revisão de UI e consulta de SLA. @qa deve avaliar contraste, foco, comportamento das abas e distinção entre ausência de SLA e erro real. Registrar revisão manual se CodeRabbit não estiver disponível, sem alegar execução inexistente. Não há mudança de estrutura de banco ou carga de dados nesta story.

## Verificação

Preparação documental: nenhum teste executado por @sm. Registrar aqui as verificações realizadas pelo fluxo principal, com resultados e limitações. Publicação e commit não fazem parte do pedido atual.

## File List

- `docs/stories/story-crm-card-modal-visual.md`
- `src/actions/bpm/Sla.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelSlaCard.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/TelefonesCardButton.tsx`

Modificações anteriores em criação de cards, motor/importação SLA e `.aiox/project-status.yaml` não pertencem a esta story.

## Resultado da implementação

Modal preserva abertura inferior, ganhou margens internas e colunas com largura limitada, fundos planos e controles discretos. As cinco abas mantêm conteúdos e contadores: Tarefas azul, Procedimento verde, Jornada violeta, Anexos âmbar e Histórico rosa. A aba ativa usa escala 105%, inativas 95% e hover/foco 100%, com movimento reduzido respeitado. Não há tarefas na lateral direita.

A causa identificada do erro de consulta em cards RD era a validação exclusiva CUID. A leitura de SLA agora aceita também o formato exato `rdcard_` seguido de 28 hexadecimais, mantendo autorização antes de consultar dados. Consulta considera somente instâncias abertas de configuração ativa, global ou da etapa atual. Sem instâncias aplicáveis retorna vazio antes de executar o motor; carregamento vazio não desenha quadro. Erros reais continuam visíveis e podem ser recarregados. Nenhuma migration ou carga de dados foi executada.

Verificações: 7 testes focais em dois arquivos aprovados (`/tmp/crm-modal-tests.log`), typecheck aprovado (`/tmp/crm-modal-typecheck.log`), lint dos arquivos alterados sem erros e com oito avisos preexistentes em CardFullViewModal (`/tmp/crm-modal-lint.log`), diff sem erros de whitespace. Revisão manual @qa: PASS estático. CodeRabbit não executado. Não houve smoke visual autenticado nem execução da suíte global nesta alteração.

Arquivo adicional: `tests/bpm/sla-card-status.test.ts`.
