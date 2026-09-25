# Story — Financeiro: Elaboração do Contrato

## Status

In Progress — regras e transições implementadas localmente; deploy e smoke autenticado pendentes.

## Story

**Como** integrante do Financeiro, **quero** conferir os dados recebidos de Solicitação de Contrato, registrar a elaboração e o envio para assinatura, **para** acompanhar a assinatura de um contrato que reflita a contratação validada.

**Escopo:** segunda etapa do pipeline Financeiro, `Elaboração do Contrato`, entre `Solicitação de Contrato` e `Formalização`. Esta story não redefine a primeira etapa nem exige a assinatura concluída para sair da segunda: o envio deve iniciar a espera pela assinatura.

## Campos da etapa

| Campo | Comportamento solicitado |
| --- | --- |
| Contrato elaborado | Sim/Não |
| Data de elaboração | Preenchida automaticamente quando `Contrato elaborado = Sim` se estiver vazia; obrigatória nessa condição |
| Contrato enviado para assinatura | Sim/Não |
| Data do envio | Data/hora registrada automaticamente no evento de envio; obrigatória quando enviado |
| Link/arquivo do contrato | Obrigatório quando enviado; aceitar referência ou arquivo pelo fluxo autenticado já existente no card |

## Critérios de aceite

1. [ ] O formulário publicado em `Elaboração do Contrato` mostra os cinco campos acima e permite registrar os indicadores Sim/Não e o contrato. Os valores existentes de cards antigos continuam legíveis; configuração e validação usam a mesma identidade de campo ativo, independentemente do rótulo exibido.
2. [ ] Para marcar `Contrato elaborado = Sim`, o sistema confirma que os dados cadastrais exigidos na etapa anterior estão completos e válidos e que Serviço contratado, Valor bruto do contrato, Forma de pagamento e Condição negociada estão definidos. Caso haja pendência, a marcação é rejeitada com os nomes dos campos; o contrato usa os valores validados na etapa anterior, inclusive o valor efetivamente negociado.
3. [ ] Quando `Contrato elaborado = Sim`, `Data de elaboração` é obrigatória. Se estiver vazia no momento em que a marcação é aceita, o sistema registra a data automaticamente. Uma data já informada é preservada; salvar novamente não altera a data registrada.
4. [ ] `Contrato enviado para assinatura = Sim` só é aceito se `Contrato elaborado = Sim` estiver válido. O envio exige `Link/arquivo do contrato` e data do envio; se faltar contrato, a alteração é bloqueada com pendência nominal. Não é possível registrar envio de contrato ainda não elaborado.
5. [ ] Na primeira marcação válida de `Contrato enviado para assinatura = Sim`, o sistema registra automaticamente a data **e hora** do envio, atualiza `Status do contrato/assinatura` para `Aguardando assinatura` e cria acompanhamento da assinatura no mecanismo de tarefas/acompanhamento já disponível. Regravar o card ou repetir a operação não duplica acompanhamento nem muda o instante original do envio.
6. [ ] Mudança posterior em dado cadastral ou em Serviço contratado, Valor bruto do contrato, Forma de pagamento ou Condição negociada gera alerta visível no card para conferir se o contrato elaborado/enviado precisa ser atualizado. O alerta identifica os dados alterados e não substitui silenciosamente o contrato já registrado.
7. [ ] O avanço real para `Formalização` aplica as mesmas regras dos itens 2 a 5 no servidor, sem salto de etapas. Com contrato elaborado, data de elaboração, envio válido, data/hora do envio e link/arquivo presentes, o avanço ocorre; com pendências, permanece na etapa e retorna a lista nominal de campos. Dados preenchidos no formulário ativo não podem ser rejeitados por exigência de chave legada, inativa ou rótulo hardcoded.
8. [ ] Quando existir integração de elaboração/assinatura de contratos aplicável ao card, o fluxo usa o contrato e o estado dessa integração sem duplicar registro ou envio. Se não houver integração configurada, o fluxo manual dos itens 1 a 7 permanece funcional. A escolha de provedor, credenciais e disparo externo dependem de contrato de integração existente e não são presumidos por esta story.

## Tarefas / checklist de execução

- [x] Inventariar, em somente leitura, a composição publicada da segunda etapa, campos ativos/inativos, chaves e requisitos; identificar precisamente os bloqueios no avanço (AC 1, 7).
- [x] Reconciliar campos configurados com validação, salvamento e transição; manter uma fonte de identidade por campo e compatibilidade de cards existentes (AC 1, 7).
- [x] Aplicar a conferência da contratação e dos dados cadastrais no evento de marcar elaboração e na transição real (AC 2, 7).
- [x] Implementar preenchimento estável da data de elaboração e o registro do instante de envio no histórico, preservando valores preexistentes (AC 3, 5).
- [x] Impedir envio sem elaboração e sem contrato, atualizar status e criar acompanhamento sem duplicatas (AC 4, 5).
- [x] Detectar alterações posteriores nos dados relevantes e criar alerta de revisão do contrato como tarefa no card (AC 6).
- [x] Conferir integração existente: ação configurável `GERAR_CONTRATO` no Gerador de Documentos; nenhuma automação ativa vinculada à segunda etapa no Turso. O fluxo manual permanece (AC 8).
- [ ] Testar salvamento, marcação dos indicadores e avanço pelo fluxo real, inclusive cards antigos, anexos, repetição da operação e erro nominal por campo (AC 1 a 8).
- [x] Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes da conclusão.

## Contexto e pontos de integração

- **Etapa anterior:** `docs/stories/story-financeiro-novo-contrato.md`, critérios 2 a 5 e 10, define quais dados são validados e a identidade do valor negociado. A implementação anterior publicou os campos da primeira etapa; seu smoke visual autenticado ainda está pendente no registro da story.
- **Pipeline base:** `docs/stories/story-rm-2026-cb8371-pipeline-financeiro.md` define seis etapas sequenciais, bloqueio nominal de pendências e anexos pelo fluxo autenticado do card.
- **Código observado:** `src/lib/bpm/pipeline-financeiro.ts` contém os cinco campos desta etapa e duas rotas de validação de transição. Ambas têm condição fixa para a segunda etapa: exigem os dois indicadores como Sim, Data de elaboração e Link/arquivo do contrato; preenchem Data do envio durante o avanço. A função legada lê valores por rótulo. Investigar o caminho chamado por `src/lib/bpm/transicao-command.ts` e pela ação de movimentação antes de corrigir, incluindo a leitura de campos globais e do formulário publicado.
- **Pontos existentes:** `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` renderiza campos da etapa; `src/actions/bpm/Campos.ts` persiste respostas; `src/lib/bpm/transicao-command.ts` prepara o avanço; `src/actions/bpm/Cards.ts` executa movimento; `src/lib/bpm/automacoes.ts` e `src/lib/bpm/automacoes/central-runtime.ts` tratam automações. Confirmar interfaces concretas antes de codificar.
- **Lacuna de modelo a resolver:** o campo atualmente definido como `Data do envio` tem tipo `data`, mas o requisito pede data **e hora**. A implementação deve persistir e apresentar o instante completo sem perder valores históricos; decidir o formato conforme a infraestrutura de campos existente, sem alterar banco por suposição.
- **Limite de banco:** cadastro/publicação de campos ou opções em produção, migration, backfill ou mutação em massa requerem relatório Vault, backup completo verificado com até 48 horas em `database-backups/pre-change/`, plano de impacto/rollback e confirmação explícita específica do usuário conforme AGENTS.md. Esta story não autoriza essas operações.
- **Contexto acumulado:** `accumulated-context.md` e `.aiox/gotchas.json` não existem nesta worktree. `[AUTO-DECISION]` Coerência conferida pela story anterior, story base, Constitution e código observado, sem inventar conteúdo ausente.
- **Integração externa:** `[AUTO-DECISION]` Tratar “quando aplicável” como uso de integração já configurada e identificada no inventário; não escolher provedor ou criar contrato externo sem requisito adicional.
- **Diagnóstico real de 25/09:** não há card ativo na segunda etapa. Os três cards de teste da primeira etapa falhavam ao avaliar a entrada porque (1) a transação HTTP no Turso expirava em 5 segundos e (2) `transicao-command.ts` cobrava os dois booleanos obrigatórios da etapa de destino já na entrada. Após ampliar o timeout e respeitar `obrigatorioEntrada`, a avaliação somente leitura dos três cards retornou `success: true`, sem movê-los.
- **Precisão do envio:** o campo configurado `Data do envio` permanece do tipo `data` e mostra o dia local; a data e hora completas são gravadas no evento `CONTRATO_ENVIADO_ASSINATURA` e apresentadas no histórico. Alterar o tipo do campo publicado para `data_hora` exigiria um checkpoint Vault e uma decisão de compatibilidade para valores históricos; isso não foi executado.
- **Limite de verificação:** nenhum card real foi movido ou editado nesta implementação. A automação de geração de contrato existe no catálogo, mas não está configurada para a segunda etapa e depende de um template selecionado pelo administrador.

## Testes de aceite

1. Dados cadastrais ou de contratação faltando/inválidos impedem marcar elaboração e listam cada campo; conjunto completo permite marcar e grava a data uma vez.
2. Marcar envio antes da elaboração falha; elaboração sem link/arquivo falha; elaboração com contrato registra instante de envio, estado `Aguardando assinatura` e um acompanhamento.
3. Repetir salvamento/envio não altera datas nem duplica acompanhamento. Arquivo válido pelo fluxo autenticado satisfaz a condição de contrato.
4. Alterar serviço, valor, forma de pagamento, condição negociada ou dado cadastral após elaboração exibe alerta de revisão e preserva o contrato registrado.
5. Card com todos os valores no formulário publicado avança para `Formalização`; remover um obrigatório bloqueia com nome do campo. O mesmo cenário com campo legado inativo não exige preenchê-lo.
6. Card histórico com valores existentes permanece legível. Na ausência de integração externa configurada, elaboração/envio manual continuam operáveis.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Integração; secundários API, Frontend e dados configurados; complexidade alta por validação de transição, automação e histórico.
- **Specialized Agents:** @dev implementa; @architect revisa identidade e evento de envio; @qa valida transição e idempotência; @ux-expert revisa alerta e formulário; Vault atua antes de mutação protegida; @github-devops conduz PR e deploy.
- **Quality Gates:** Pre-Commit (@dev): lint, typecheck, testes, build e revisão de campos ativos/legados. Pre-PR (@github-devops): conferir regressão de cards históricos e automações. Pre-Deployment (@github-devops): conferir configuração, evidência Vault e rollback quando houver mutação protegida.
- **Self-Healing (Story 6.3.3):** @dev light, até 2 iterações/15 min, corrige CRITICAL; @qa full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; @github-devops check, apenas reporta.
- **Focus Areas:** bloqueio por chaves/rótulos hardcoded, consistência dos dados herdados, data/hora do envio, anexos autenticados, duplicação de acompanhamento, alerta após alteração e acesso ao formulário.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-elaboracao-contrato.md` — critérios, diagnóstico, checklist e registro.
- `src/lib/bpm/pipeline-financeiro.ts` — regra canônica de elaboração e envio.
- `src/lib/bpm/novo-contrato-financeiro-server.ts` — datas, status e tarefas no salvamento.
- `src/lib/bpm/transicao-command.ts` — prazo transacional e semântica dos campos obrigatórios do destino.
- `src/lib/bpm/historico-descricao.ts` — descrição do envio com data e hora no histórico.
- `src/actions/bpm/Cards.ts` — integração da regra no salvamento e erros nominais.
- `tests/bpm/pipeline-financeiro.test.ts` — cenários de elaboração, envio e transição.
- `tests/bpm/novo-contrato-financeiro-server.test.ts` — persistência de status, histórico e acompanhamento.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-25 | 0.1 | Draft da segunda etapa, critérios e validação preliminar | River (@sm) |
| 2026-09-25 | 0.2 | Correções locais, diagnóstico da transição real em leitura e quality gates | Codex |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PARTIAL** (fluxo de acompanhamento, integração aplicável e representação de data/hora precisam de inventário antes da implementação); referências **PASS**; autossuficiência **PASS**; testes **PASS**; CodeRabbit **PASS**. **Resultado: READY para investigação e implementação local.** Publicação/mutação de configuração protegida depende do checkpoint Vault.
