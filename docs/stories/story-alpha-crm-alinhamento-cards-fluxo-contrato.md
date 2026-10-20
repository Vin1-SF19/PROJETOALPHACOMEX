# Story — Alpha CRM: alinhamento dos cards e fluxo de contrato Comercial/Financeiro

## Status

In Progress — código implementado e revisado em 20/10/2026. Lint/typecheck/testes aprovados; build de produção interrompido por OOM do ambiente. Publicação bloqueada até build aprovado. Configuração persistente preparada, não aplicada, aguardando checkpoint Vault específico.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, revisão de permissões e idempotência

## Story

**Como** equipe comercial e financeira do Alpha CRM, **quero** cards com nomenclatura clara e acompanhamento do contrato entre os pipelines vinculados, **para** enviar e acompanhar a contratação sem duplicar registros financeiros nem perder documentos, autoria e histórico.

## Fonte, contexto e limites

- Fonte funcional: análise apresentada ao usuário do arquivo `/home/ialpha/projetos/RESUMO PLAUD - ALINHAMENTO 1 CRM.pdf` e autorização subsequente: “faça as modificações dos card e faça as melhorias do fluxo, as renomeações”.
- Esta story materializa somente ajustes de cards, renomeações e ciclo Comercial ↔ Financeiro descritos naquela análise. Não há epic novo numerado; o pedido direto e as stories relacionadas são os artefatos de origem.
- A proposta de dispensar obrigatoriedades para administradores e líderes foi expressamente separada para aprofundamento posterior: [backlog de movimentação excepcional](./story-alpha-crm-movimentacao-excepcional-admin-lideres.md). Não implementar bypass nesta entrega.
- O encaminhamento Comercial → Financeiro já existe. A melhoria deve completar o retorno do documento ao Comercial e as ações específicas após o fechamento; não instalar um segundo fluxo concorrente.
- Não criar funis TTD/Habilitação, transferências entre serviços, novas cadências, comunicação automática nem novos indicadores BI. O usuário confirmou a manutenção exata das três formas de pagamento atuais; novas opções devem aparecer apenas como pendência no relatório final.
- Não equiparar contrato gerado a validado, enviado ou assinado. Não equiparar informação comercial de pagamento à confirmação financeira.

## Acceptance Criteria

1. A etapa comercial passa a ser apresentada como **Contrato fechado**, com suporte aos registros legados **Fechado**. O reconhecimento funcional usa identidade técnica estável quando disponível e compatibilidade explícita para configurações legadas; uma mudança de label não pode desativar status, badge, cor, validação, automação nem resumo pós-fechamento.
2. **Stand By** passa a ser apresentado como **Stand-by — follow-up semanal**, preservando o reconhecimento legado e a recorrência atualmente configurada. A renomeação não cria nem modifica a cadência ou envia comunicações.
3. Nos campos comerciais abrangidos pelo alinhamento, a expressão **exigido na entrada** deixa de aparecer no label. A indicação de campo obrigatório, sua acessibilidade e as regras configuradas de validação continuam efetivas na UI e no servidor.
4. O conteúdo explicativo/script da etapa usa **Orientações da etapa**; os itens executáveis usam **Checklist da etapa**. A ausência real de conteúdo apresenta estado vazio apropriado. Falha de carregamento ou falta de permissão não pode ser mascarada como ausência de conteúdo; corrigir erros reproduzidos e registrar evidência.
5. O histórico RD apresenta o autor original quando houver fonte verificável no payload importado. Autor da atividade, responsável pelo negócio e autor de eventual correção permanecem distintos. Ausência de autoria não é preenchida com o responsável atual nem com um nome inventado. Recuperação em lote, se necessária, fica preparada e sujeita ao checkpoint Vault.
6. Preparar a configuração reutilizando campos/formulários existentes para **Fechado no tarifário padrão**, com opções **Sim/Não**, e e-mail válido exigido na entrada em **Contrato fechado**. Não criar obrigação global hardcoded nem bloquear a consulta de registros antigos. O plano deve identificar campos canônicos, associação por etapa e comportamento de reentrada, sem aplicar configuração ao banco antes do checkpoint.
7. O card Comercial pode consultar o contrato disponível no card Financeiro da mesma contratação por vínculo autorizado, com indicação suficiente de seu estado. Documento apenas gerado para conferência não é apresentado como validado/pronto para envio. O acesso ao documento ocorre por endpoint autenticado do card Comercial, que valida o vínculo e o documento no servidor, sem conceder acesso global ao pipeline Financeiro.
8. Ao salvar a conclusão da elaboração no Financeiro, disponibilizar o contrato ao Comercial somente quando existir documento válido: geração em estado `FINALIZADO` com PDF, ou anexo válido explicitamente marcado como elaborado. O acompanhamento aplicável passa para **Contrato a enviar**, sem regredir um contrato já enviado/assinado ou outra informação financeira posterior. Evento repetido ou reprocessado não duplica documento, histórico, tarefa ou encaminhamento.
9. O responsável comercial autorizado dispõe da ação específica **Registrar envio** após o fechamento e encaminhamento ao Financeiro. A permissão dessa ação é validada no servidor, preservando o bloqueio geral de edição/movimentação do card final encaminhado. Usuário com consulta apenas não ganha escrita por essa melhoria.
10. A ação comercial **Encaminhar pagamento para conferência** reutiliza o card Financeiro vinculado à mesma contratação e cria/reutiliza uma única tarefa de conferência, sem duplicar card ou afirmar confirmação financeira por status manual. A deduplicação não usa apenas a empresa: duas contratações distintas da mesma empresa não podem compartilhar indevidamente um único card Financeiro.
11. Pagamento, assinatura e prontidão do documento continuam sendo estados distintos. O fluxo existente Financeiro → Operacional e seus requisitos de assinatura, pagamento, NF e dados operacionais não são relaxados. Ações manuais, automações e reprocessamentos respeitam os contratos vigentes.
12. Toda ação efetiva registra ator e mudança relevante no histórico, preserva proteção contra concorrência, e só informa sucesso/realtime após commit. Falha de autorização, vínculo inválido, documento ausente, conflito ou falha de gravação mantém o estado anterior e retorna mensagem acionável.
13. Não executar alteração estrutural, migration, seed, backfill ou mudança de configuração em lote sem relatório Vault, backup completo verificado de até 48 horas e confirmação explícita específica do usuário. O relatório deve conter ambiente/banco, comandos, impacto, riscos, alternativa não destrutiva e rollback, conforme `AGENTS.md`. Nenhum dump ou dado real entra no Git.
14. Existem regressões focais para reconhecimento das etapas antigas/novas, campos obrigatórios preservados, histórico RD com/sem autoria, estado vazio versus erro, permissão pós-fechamento, documentos vinculados e idempotência financeira. Executar os quatro gates do projeto; registrar resultados reais, limitações e falhas preexistentes separadamente. Atualizar checklist e File List antes da conclusão.

## Tasks / Subtasks

- [x] Criar story atual e backlog separado; delimitar autorização e dependências.
- [x] Inventariar reconhecimento de etapas, status, campos, contratos, vínculos e permissões; preservar alterações locais de outras entregas (AC 1–12).
- [x] Centralizar compatibilidade das identidades/labels e aplicar renomeações nos pontos afetados, mantendo regras existentes (AC 1–2).
- [x] Ajustar labels comerciais, Orientações e Checklist; reproduzir ausência/erro e corrigir somente lacunas verificadas (AC 3–4).
- [x] Revisar apresentação/projeção da autoria RD e preparar eventual recuperação auditável sem execução em lote (AC 5, 13).
- [x] Preparar configuração revisável para tarifário Sim/Não, e-mail ao fechar e nomes persistidos, com dry-run e rollback quando aplicável (AC 1–2, 6, 13).
- [x] Completar consulta e retorno do contrato validado via vínculo Comercial/Financeiro, com proteção contra regressão de status (AC 7–8, 11–12).
- [x] Implementar ação pós-fechamento estreita e autorizada para acompanhamento de envio; manter somente leitura geral (AC 9, 12).
- [x] Revisar registro de pagamento e deduplicação pela contratação, incluindo duas contratações da mesma empresa (AC 10–12).
- [x] Cobrir cenários focais, executar gates e revisar autorização/concorrência/idempotência (AC 14). Build executado e bloqueado por OOM; não aprovado.
- [x] Atualizar evidências, limitações, File List e status; distinguir código entregue de configuração ainda não aplicada (AC 13–14).

## Dev Notes

### Contexto acumulado e contratos anteriores

`docs/stories/accumulated-context.md` não foi localizado na preparação desta story. `.aiox/gotchas.json` e os documentos de arquitetura/framework nos caminhos esperados da configuração também não foram localizados. Não há orientação arquitetural específica nesses artefatos ausentes. Usar o código atual e as fontes abaixo, sem inventar conteúdo para substituí-los.

- [Pós-fechamento](./story-alpha-crm-fechado-status-pos-fechamento.md#acceptance-criteria): cinco códigos canônicos existentes (`AGUARDANDO_CONTRATO`, contrato a enviar, enviado, pagamento confirmado e assinado), coluna `BpmCard.statusPosFechamento`, validação server-side, histórico, compare-and-swap, realtime após commit e legado nulo sem backfill de leitura. A nomenclatura de exibição pode evoluir; códigos persistidos não devem ser alterados incidentalmente.
- [Conclusão Financeiro/Operacional](./story-alpha-crm-conclusao-financeiro-handoff-operacional.md#acceptance-criteria): assinatura, pagamento e NF válidos mais dados exigidos condicionam a conclusão; reprocessamento não cria outro card Operacional. A autorização atual não modifica essas condições.
- [Movimentação manual RD](./story-alpha-crm-movimentacao-manual-importados-rd.md): exceção existente tem origem persistida, confirmação contextual, pendências auditadas, concorrência e identidade RD aceita no publicador. Não generalizar esse mecanismo para admin/líder nesta entrega.
- [Constitution](../../.aiox-core/constitution.md): story antes de implementação, regras no servidor/serviços, qualidade e preservação dos gates.
- `AGENTS.md`: exige Vault para alterações estruturais e operações em lote; a autorização de implementar melhorias não substitui a confirmação específica da execução no banco.

### Pontos de integração conhecidos

Estes são arquivos existentes para orientar o inventário, não a File List final:

| Responsabilidade | Referência |
|---|---|
| Status e reconhecimento do pós-fechamento | `src/lib/bpm/status-pos-fechamento.ts` |
| Resumo de contratação e vínculo | `src/lib/bpm/resumo-contratacao-server.ts` |
| Regras financeiras de novo contrato | `src/lib/bpm/novo-contrato-financeiro.ts` |
| Autorização e movimento canônico | `src/lib/bpm/ownership.ts`, `src/lib/bpm/transicao-command.ts`, `src/actions/bpm/Cards.ts` |
| Automações de encaminhamento | `src/lib/bpm/automacoes/central-runtime.ts` |
| Labels e apresentação do card | `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`, `CardFullViewModal.tsx` |
| Orientações e checklists | `src/app/PainelAlpha/AlphaCRM/CardModal/ConteudoScriptEtapa.tsx`, `PainelChecklistsCard.tsx`, `src/actions/bpm/Checklists.ts` |
| Histórico RD | `src/lib/bpm/rd-station-history.ts` |

Não foram solicitadas bibliotecas novas nem variáveis de ambiente adicionais. Confirmar as interfaces reais antes de editar. O workspace contém mudanças de outras entregas; revisar diff por arquivo e preservar essas mudanças.

### Decisões e dependências

- `[AUTO-DECISION] Onde exigir e-mail? → Na entrada em Contrato fechado, através da configuração existente (reason: é o ponto proposto na análise autorizada; o pedido não exige e-mail global em Novo Lead).`
- `[USER-DECISION] Formas de pagamento → Manter exatamente as três opções atuais; registrar novas opções somente como pendência no relatório final.`
- `[IMPLEMENTATION-DESIGN] Retorno do contrato → Conclusão explícita da elaboração e documento válido habilitam o retorno automático; expor Registrar envio e Encaminhar pagamento para conferência como ações estreitas. Documento acessível por endpoint autenticado do Comercial, tarefa financeira única e confirmação financeira preservada no Financeiro.`
- `[AUTO-DECISION] Como tratar renomeação persistida e recuperação histórica? → Preparar plano/script e separar aplicação em banco do código (reason: política explícita de Vault).`
- `[AUTO-DECISION] Criar tarefa externa/ClickUp? → Não, a missão autoriza dois artefatos locais e não forneceu epic externo; manter rastreabilidade nas stories do repositório.`
- Homologação da prontidão do contrato com Nai/Naila permanece etapa operacional; testes sintéticos não substituem a conferência do documento e da responsabilidade de validação.
- Novos funis, cadências e bypass admin/líder permanecem fora desta story.

## Testing

- Usar padrões existentes de `tests/bpm/` para helpers, actions com autenticação/Prisma controlados e componentes React; não escrever em dados reais.
- Etapas: nome antigo/novo, chave estável, variante legada sem chave, etapa não relacionada, status residual fora do fechamento.
- Campos: remover texto redundante sem dispensar obrigatório; e-mail ausente/inválido, valor existente e configuração por etapa; cadastro antigo consultável.
- Histórico: autor verificado, payload sem autor, autoria distinta de responsável, conteúdo legado preservado.
- Fluxo: geração pendente versus `FINALIZADO` com PDF versus anexo explicitamente elaborado; consulta autorizada/negada pelo card Comercial; card final encaminhado admite somente ação específica; ator sem vínculo não obtém escrita; encaminhar pagamento não o confirma financeiramente.
- Idempotência e concorrência: retry do retorno do contrato, pagamento com vínculo já existente, duas contratações da mesma empresa, falha transacional sem histórico parcial, status posterior preservado.
- Regressões: conclusão financeira ainda exige assinatura/pagamento/NF; exceção RD permanece limitada ao contrato existente.
- Gates: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; nenhuma aprovação por inspeção estática apenas.

## CodeRabbit Integration

- **Story Type Analysis:** Integration; secundárias Frontend, API e Security. Complexidade alta pela interseção entre vínculo, autorização e automações.
- **Specialized Agents:** `@dev` para implementação/revisão inicial; `@architect` para fronteiras e segurança; `@ux-design-expert` para UI; `@qa` para verificação. Vault/Data Engineer somente se surgir mudança de banco. Atribuições são responsabilidades previstas, não execuções já realizadas.
- **Quality Gates:** revisão pre-commit antes de concluir; pre-PR/pre-deployment pelo DevOps somente quando houver autorização para essas etapas.
- **Self-Healing:** `@dev`, light, até 2 iterações/15 minutos para CRITICAL; HIGH documentado para revisão; `@qa`, full, até 3 iterações/30 minutos para CRITICAL/HIGH. Indisponibilidade da CLI deve ser registrada conforme fallback do projeto, sem inventar aprovação.
- **Focus Areas:** autorização de anexos e ação específica; manutenção do readonly geral; idempotência por contratação; compatibilidade de etapas; auditoria e rollback; acessibilidade dos estados de erro/vazio.
- [x] Revisão de código executada pelo QA; CodeRabbit indisponível no PATH e no caminho configurado. Achados corrigidos e reavaliados.

## Validação da story — River

Checklist aplicado: `.aiox-core/product/checklists/story-draft-checklist.md`.

| Categoria | Resultado | Observação |
|---|---|---|
| Objetivo e contexto | PASS | Pedido atual e exclusões explícitos. |
| Orientação técnica | PASS | Pontos de integração e invariantes anteriores identificados. |
| Referências | PASS | Contratos anteriores resumidos; artefatos ausentes declarados. |
| Autossuficiência | PASS | Requisitos, decisões e dependências separados. |
| Testes | PASS | Casos de falha, concorrência, permissão e gates definidos. |
| CodeRabbit | PASS | Tipos, responsabilidades, gates e fallback previstos. |

**READY para implementação local; clareza 9/10.** Aplicação ao banco permanece condicionada ao checkpoint Vault. Responsabilidade de validação final do contrato requer homologação operacional. O resultado do checklist valida o draft, não aprova código ou produção.

## Dev Agent Record

### Completion Notes

Implementação local concluída nos pontos de UI, compatibilidade de etapas, autoria RD e acompanhamento contratual. Nenhuma mudança persistente de banco ou publicação foi executada. Configuração revisável e rollback preparados, com backup completo verificado pelo Vault; aguardam autorização específica e publicação do código compatível.

Relatório funcional e pendências: [entrega](./relatorio-alpha-crm-alinhamento-cards-fluxo.md). Revisão de dados: [Vault](./relatorio-vault-crm-alinhamento.md).

Decisões adicionais verificadas no código: o UUID da URL de conferência é `tokenAcesso`, não ID do documento; o upload confirma o campo diretamente, por isso tem hook próprio; eventos de sistema omitem `atorUserId`; IDs determinísticos de tarefas reutilizam o gerador compatível com CUID. Tarefa de envio é única por contratação, inclusive após substituição do PDF. A solicitação de conferência financeira não confirma pagamento.

DoD: requisitos de código e configuração preparada atendidos; segurança/revisão e testes executados; nenhuma dependência ou variável de ambiente nova. Homologação autenticada com Nai/Naila, aplicação da configuração e publicação permanecem pendentes. Não houve exercício de movimentação/upload em dados reais. Documentos de framework ausentes foram registrados nas Dev Notes. Modelo executor: GPT-6/Codex.

### File List

- `docs/stories/relatorio-alpha-crm-alinhamento-cards-fluxo.md`
- `docs/stories/relatorio-vault-crm-alinhamento.md`
- `docs/stories/story-alpha-crm-alinhamento-cards-fluxo-contrato.md`
- `docs/stories/story-alpha-crm-movimentacao-excepcional-admin-lideres.md`
- `scripts/configurar-alinhamento-crm.mts`
- `src/actions/bpm/AcompanhamentoContratacao.ts`
- `src/actions/bpm/Anexos.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/NolossLeads.ts`
- `src/actions/bpm/RdStationHistorico.ts`
- `src/actions/gerador-documentos.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/ConteudoScriptEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelAcompanhamentoContratacao.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/app/api/bpm/cards/[cardId]/contrato/route.ts`
- `src/lib/bpm/automacao-novos-leads.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/contratacao-comercial-server.ts`
- `src/lib/bpm/em-tratativa.ts`
- `src/lib/bpm/formularios-etapa.ts`
- `src/lib/bpm/historico-descricao.ts`
- `src/lib/bpm/novos-leads.ts`
- `src/lib/bpm/rd-station-history.ts`
- `src/lib/bpm/status-pos-fechamento.ts`
- `src/lib/bpm/timeline.ts`
- `src/lib/bpm/transicao-command.ts`
- `tests/bpm/acompanhamento-contratacao-actions.test.ts`
- `tests/bpm/anexos-idempotencia.test.ts`
- `tests/bpm/conhecimento-scripts-ui.test.ts`
- `tests/bpm/contratacao-comercial-download.test.ts`
- `tests/bpm/contratacao-comercial.test.ts`
- `tests/bpm/crm-configuracoes-centralizadas.test.ts`
- `tests/bpm/em-tratativa.test.ts`
- `tests/bpm/pipeline-config-workspace.test.ts`
- `tests/gerador-documentos/finalizar-documento.test.ts`

### QA Results

#### Revisão de Quinn — 20/10/2026

**Decisão: NEEDS_WORK / CONCERNS — build de produção não concluído por limitação do ambiente.** A revisão do código desta entrega não deixou achados abertos. Esta decisão não autoriza publicação nem aplicação de configurações no banco.

**Escopo revisado:** serviço de acompanhamento Comercial/Financeiro, actions específicas, endpoint autenticado do documento, painel de acompanhamento e integração com salvamento financeiro, automações, finalização do gerador e registro de anexos. Comparação dos arquivos preexistentes com `/tmp/crm-alinhamento-baseline` para separar alterações anteriores. Nenhuma alteração de código ou escrita no banco foi feita pelo QA.

**Achados corrigidos e revalidados:**

- Registro de envio atualiza o campo canônico financeiro e publica `CAMPO_ALTERADO`, preservando os fluxos configurados de acompanhamento da assinatura.
- Cards cancelados deixam de ser elegíveis; estados financeiros posteriores impedem criar indevidamente nova pendência de envio.
- Documento gerado é resolvido por `tokenAcesso`, conforme o contrato real da URL de conferência, exigindo `FINALIZADO`, PDF e origem financeira correta.
- Publicação por sistema omite `atorUserId` em vez de enviar `null`; regressão verifica o schema real do evento.
- IDs determinísticos de tarefa obedecem ao schema existente e deduplicam por contratação. Concluir uma tarefa manualmente não substitui o registro efetivo de envio.
- Upload como última condição de prontidão executa o retorno dentro da transação e invalida o Comercial após commit.

**Segurança e consistência:** consulta não materializa tarefas nem concede escrita; ação específica revalida acesso no servidor sem liberar edição/movimentação geral. Documento depende de vínculo explícito e único, sem inferência por empresa. Conferência de pagamento não altera confirmação financeira. CAS protege as ações, histórico/eventos são transacionais e realtime ocorre após commit. As exigências Financeiro → Operacional foram preservadas.

**Evidências de validação:**

- QA executou diretamente quatro arquivos focais: `contratacao-comercial`, `acompanhamento-contratacao-actions`, `contratacao-comercial-download` e `anexos-idempotencia`: **37 testes aprovados**.
- `npm run lint`: **0 erros, 1.193 warnings**; log `/tmp/crm-lint-verified.log`. Warnings existentes no workspace não foram atribuídos indiscriminadamente a esta entrega.
- `npm run typecheck`: **exit 0**; log `/tmp/crm-typecheck-verified.log`.
- `npm test`: **654 arquivos aprovados; 4.941 testes aprovados, 4 ignorados e 1 todo**; log `/tmp/crm-test-complete.log`. A falha intermediária do teste de finalização foi corrigida com seu posicionamento dentro do `describe` e a suíte global foi reexecutada com sucesso.
- `npm run build`: **não aprovado**. Execução isolada/serial registrada em `/tmp/crm-build-complete.log` terminou com `SIGKILL`. O executor informou evidência do kernel em 20/10/2026 16:34:19: `global_oom`, processo `MainThread` PID 501010, aproximadamente 13 GB RSS. A causa ambiental não equivale a build concluído; repetir em ambiente com recursos suficientes antes de publicar.
- CodeRabbit CLI indisponível; revisão manual de código usada como fallback previsto na configuração.

**Pendências do gate:** concluir o build em ambiente adequado. Aplicação das configurações persistidas permanece submetida ao checkpoint Vault; homologação operacional do documento com Nai/Naila permanece pendente. Não houve homologação visual em navegador nesta revisão.

**Arquivo alterado pelo QA:** somente esta seção da story. Recomendação: manter a entrega sem publicação até a confirmação do build; não há correção de código aberta decorrente desta revisão.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-10-20 | 1.0 | Story autorizada para cards, renomeações e fluxo Comercial/Financeiro; bypass separado. | River |
| 2026-10-20 | 1.1 | Confirmação do catálogo atual e detalhamento do retorno do documento, envio e conferência financeira. | River |

## DoD e liberação

- [x] Implementação e critérios locais revisados; proteção de autorizações, transações, documentos e idempotência verificada.
- [x] Checklist da story e File List atualizados; relatório funcional e relatório Vault disponíveis.
- [x] `npm run lint`: zero erros, 1.193 avisos existentes; sem novos avisos nos arquivos desta implementação.
- [x] `npm run typecheck`: aprovado.
- [x] `npm test`: 654 arquivos, 4.941 testes aprovados, 4 ignorados, 1 todo. Cobertura agregada: 64,91% statements / 68,41% lines; sem meta nova definida nesta story.
- [ ] Build de produção concluído. `npm run build` e repetição isolada (`NEXT_DIST_DIR=.next-crm-alinhamento`) compilaram com avisos em módulo Bibble preexistente, mas worker foi encerrado. A última tentativa sequencial teve SIGKILL; kernel em 20/10/2026 16:34:19 UTC registrou `global_oom` e processo de cerca de 13 GB RSS. Não alterar serviços de terceiros nem publicar com gate incompleto. Log: `/tmp/crm-build-complete.log`.
- [ ] Homologação autenticada/visual e ciclo com Nai/Naila em ambiente apropriado.
- [ ] Aplicação da configuração no banco (prévia + rollback prontos; depende do código publicado e aprovação específica).
- [x] Nenhuma dependência/schema/variável de ambiente nova. Sem mutation remota, deploy, commit ou push nesta entrega.

**Estado de entrega:** código disponível para revisão; liberação permanece pendente de build em ambiente com recursos suficientes, homologação e checkpoint do banco. A falha de build não foi atribuída ao código e também não foi contada como aprovação.
