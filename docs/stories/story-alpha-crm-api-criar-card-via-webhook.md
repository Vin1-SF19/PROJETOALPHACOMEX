# Story: API para criar cards em Novos Leads

## Status

Implementada localmente; publicação depende dos gates de staging e da migration de atribuição de closers.

## Story

Como sistema integrado ao Alpha CRM, quero criar cards reais em Novos Leads por uma API autenticada, para que novas oportunidades entrem no pipeline Revisão de Radar e recebam o closer pelo rodízio configurado.

## Critérios de aceitação

1. Um endpoint REST sob um webhook existente cria cards reais somente no pipeline ativo Revisão de Radar.
2. O endpoint exige o segredo individual já guardado como hash no webhook e uma chave de idempotência.
3. O pipeline e a etapa inicial são resolvidos pelo servidor; o payload não pode escolher pipeline, etapa ou responsável.
4. Com distribuição ativa, o card recebe um dos closers selecionados conforme presença e rodízio persistente.
5. Empresa, card, atribuição, membro responsável, histórico, evento e efeitos iniciais são gravados atomicamente.
6. Repetições da mesma chave retornam o card original sem duplicar card ou turno de distribuição.
7. Quando a distribuição estiver inativa ou sem closer elegível, o card não é criado e a API retorna erro apropriado.
8. Payload, autenticação, idempotência, pipeline, falhas de atribuição e sucesso têm cobertura de testes.
9. A migration e a publicação seguem primeiro em staging após o gate Vault, backup verificado e aprovação explícita.

## Checklist

- [x] Implementar rota REST autenticada com segredo do webhook existente, limite de payload e rate limit.
- [x] Validar empresa, CNPJ, campos do lead e etapa inicial de Revisão de Radar.
- [x] Integrar o rodízio automático sem aceitar responsável do cliente.
- [x] Criar card e efeitos relacionados em transação, com suporte a idempotência.
- [x] Documentar contrato, payload, headers e respostas, incluindo `cardId` e e-mail do closer atribuído também em reenvios idempotentes.
- [x] Adicionar testes direcionados da rota e do serviço.
- [ ] Rodar todos os gates no ambiente de staging e aplicar a migration de atribuição após as aprovações exigidas.
- [x] Adicionar endpoint por ID para avançar Novo Lead → Agendar reunião → Reunião Agendada, exigindo campos obrigatórios e data/hora da reunião.
- [x] Validar autenticação, escopo do pipeline, idempotência e rollback da mudança de etapa com data da reunião.
- [x] Exibir nos webhooks os campos obrigatórios e seus IDs por transição, com cópia do ID, condições e indicação dos parâmetros nativos.
- [x] Proteger a consulta de campos com a permissão administrativa existente e validar a interação da nova opção.

## Evidências

- Testes direcionados: 8 passaram.
- Lint dos arquivos novos: passou.
- `npm run typecheck`: passou.
- `npm run lint`: passou com 0 erros; o repositório mantém avisos de lint existentes.
- `npm test -- --config vitest.noenv.config.ts`: 702 arquivos passaram, 20 falharam; 5.438 testes passaram e 2 falharam. As falhas fora desta feature incluem testes que requerem `node:sqlite`, uma falha de resolução de `next/server` e dois testes de UI com mock incompatível.
- A migration de atribuição permanece preparada, sem aplicação em banco ou publicação.
- Nenhum arquivo `.env` foi aberto ou alterado nesta implementação.

## File List

- `src/app/api/bpm/webhooks/[slug]/cards/route.ts`
- `src/actions/bpm/WebhookCampos.ts` — consulta administrativa do catálogo do pipeline do webhook.
- `src/lib/bpm/webhook-campos-server.ts` — campos publicados e requisitos de saída/entrada por transição.
- `src/components/bpm/automacoes/WebhookCamposObrigatorios.tsx` — painel de consulta e cópia dos IDs.
- `src/components/bpm/automacoes/MotorCentralPanel.tsx` — opção de ver campos em cada webhook.
- `tests/bpm/webhook-campos-server.test.ts`
- `tests/bpm/webhook-campos-actions.test.ts`
- `tests/bpm/webhook-campos-react.test.ts`
- `src/app/api/bpm/webhooks/[slug]/cards/[cardId]/etapa/route.ts` — endpoint autenticado de avanço nas etapas de reunião.
- `src/lib/bpm/mover-card-webhook-server.ts` — valida payload, escopo, sequência e delega ao comando canônico de transição.
- `src/lib/bpm/transicao-command.ts` — parâmetro opcional de data da reunião para integração, persistido com a etapa na mesma transação.
- `src/lib/bpm/criar-card-webhook-server.ts` — devolve `cardId` e `closerEmail` na criação e em reenvios idempotentes.
- `tests/bpm/criar-card-webhook-route.test.ts`
- `tests/bpm/mover-card-webhook-route.test.ts`
- `tests/bpm/mover-card-webhook.test.ts`
- `tests/bpm/movimentacao-importados-rd-command.test.ts` — cenários adicionais de data e rollback para integração.
- `tests/bpm/criar-card-webhook.test.ts` — cobre a resolução do e-mail do closer nos resultados novos e duplicados.
- `docs/api/alpha-crm-criar-card-via-webhook.md` — documenta o campo `closerEmail` e a resposta de sucesso.
- `docs/stories/story-alpha-crm-api-criar-card-via-webhook.md`

## Dev Agent Record — avanço de etapas por webhook

- Pedido: mover um card pelo ID para Agendar reunião ou Reunião Agendada, respeitando os campos obrigatórios existentes.
- Implementação local na branch `staging`; a nova rota reutiliza o motor canônico e seu histórico, eventos, regras, checklists, idempotência e controle de concorrência.
- Para Reunião Agendada, a data/hora com fuso é obrigatória e salva atomicamente com os campos e a etapa. O responsável atual é preservado.
- Testes direcionados: 6 arquivos e 72 testes passaram, abrangendo criação existente, movimentação administrativa/RD, nova API e rollback.
- `npm run typecheck`: passou.
- `npm run lint -- --quiet`: passou, sem erros.
- Suíte completa com configuração temporária em `/tmp` e sem carregar `.env`: 704 arquivos passaram e 20 falharam; 5.458 testes passaram e 2 falharam. São os mesmos erros da execução anterior: `node:sqlite` indisponível, resolução de `next/server` e mock `getDraftBase` em teste de UI.
- Nenhuma alteração de estrutura, migration, configuração de transições, arquivo de ambiente ou publicação foi executada nesta extensão. Build e validação remota em staging permanecem pendentes.

## Dev Agent Record — consulta de campos nos webhooks

- Pedido: adicionar na configuração dos webhooks a opção de consultar os campos obrigatórios e seus IDs.
- Cada endpoint oferece a consulta sob demanda, separada por transição, com nome, ID copiável, tipo, opções, condições e indicação de campos sem edição naquele movimento.
- A leitura aplica o catálogo ativo/publicado e o escopo dos requisitos de saída/entrada, usando o helper canônico de aplicabilidade. Ela não avalia condições de um card específico nem dispensa requisitos da API.
- Parâmetros nativos da criação e `dataReuniao` são explicados separadamente dos IDs de `camposValores`.
- A action exige sessão e a permissão `configurarEtapas`, resolve o pipeline pelo endpoint e não seleciona segredos.
- Testes direcionados: 6 arquivos e 34 testes passaram, incluindo permissões, requisitos por transição, cópia de ID e regressão da API de movimentação.
- `npm run typecheck`: passou.
- `npm run lint -- --quiet`: passou, sem erros.
- Suíte completa com configuração temporária fora do projeto e sem carregar `.env`: 707 arquivos passaram e 20 falharam; 5.469 testes passaram e 2 falharam. As falhas são as mesmas da execução anterior, fora desta consulta.
- Nenhuma mudança no banco, nas regras de movimentação ou nos arquivos de ambiente. Publicação e validação remota em staging continuam pendentes.
