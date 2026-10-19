# Story: cadastro de lead na nova etapa Novo Lead

## Status

Ready for Review

## Story

Como usuário do Alpha CRM, quero abrir o cadastro de lead na etapa inicial `Novo Lead` do pipeline `Revisão de Radar` reconstruído manualmente, reutilizando o formulário de criação que já existia.

## Contexto

Após o reset do CRM, o pipeline novo `Revisão de Radar` tem uma etapa inicial ativa chamada `Novo Lead` (singular). O código de criação reconhece somente `Novos leads` (plural), por isso o botão `+` não aparece e a action rejeitaria a criação. O `NovoCardModal` já oferece empresa existente ou nova com CNPJ, razão social, nome fantasia, município, UF e responsável. Não há necessidade de migration ou seed.

## Critérios de aceitação

1. [x] A primeira etapa ativa chamada `Novo Lead` ou `Novos leads` oferece o botão de cadastro no board e abre o formulário existente.
2. [x] `CriarCardBpm` aceita esse destino em suas duas validações e continua rejeitando outra etapa, etapa fora da primeira posição, pipeline inativo ou destino ambíguo.
3. [x] O modal identifica a etapa pelo nome configurado, sem exibir um nome antigo diferente.
4. [x] A listagem de cards reconhece a nova etapa para os indicadores e leads virtuais do NoLoss no pipeline Revisão de Radar.
5. [x] Nenhuma configuração do banco, pipeline, campo ou validação é criada automaticamente.
6. [x] Rodar testes focados, `npm run lint`, `npm run typecheck` e `npm test`; registrar resultados e File List.

## Checklist

- [x] Localizar a divergência entre o nome da etapa atual e o código.
- [x] Ajustar reconhecimento compartilhado, listagem e rótulo do formulário.
- [x] Validar o fluxo em testes e quality gates.

## Verificação

- Leitura do Turso confirmou `Revisão de Radar` com `Novo Lead` como etapa inicial ativa (`ordem=0`, `ehInicial=1`), seguida de `Sem viabilidade`. Nenhum dado foi alterado nessa leitura.
- Testes focados: 4 arquivos, 50 testes passaram.
- `npm run lint`: passou com 0 erros e 1.192 avisos preexistentes.
- `npm run typecheck`: passou.
- `npm run build`: passou.
- `npm test` fora do sandbox: 529 arquivos passaram, 1 falhou; 3.914 testes passaram, 2 falharam em `tests/debug/error-bus.test.ts` (falhas também presentes antes desta story). Os testes de CLI passaram fora do sandbox.

## File List

- `docs/stories/story-alpha-crm-cadastro-novo-lead-revisao-radar.md`
- `src/lib/bpm/novos-leads.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `tests/bpm/novos-leads.test.ts`
- `tests/bpm/criar-card-nova-empresa.test.ts`
- `tests/bpm/novo-card-modal-react.test.ts`

## Dev Agent Record — ajuste do formulário (2026-10-19)

Pedido: Canal de origem como select com as opções de Metas/Cadastro de Clientes e personalização; remover Qualificação do cadastro; Radar pretendido opcional.

### Blueprint de integração (Scout)

- [x] Criar `src/lib/comercial/canais-origem.ts`: lista compartilhada com a união das opções já presentes nos módulos, preservando valores existentes.
- [x] Atualizar `src/app/PainelAlpha/CadastroClientes/ModalCadastro/origens-lead.ts`: reexportar a lista compartilhada sem quebrar consumidores.
- [x] Atualizar `src/components/comercial/ModalGerenciamentoLeads.tsx`: consumir a lista comum, preservando os rótulos de indicação e fluxos de parceiros/prospecção.
- [x] Criar `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/SeletorCanalOrigemLead.tsx`: select nativo, botão Personalizar, confirmação/cancelamento de texto com limite de 120 caracteres.
- [x] Atualizar `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`: integrar seletor, retirar Qualificação e permitir radar vazio no payload.
- [x] Atualizar `src/actions/bpm/Cards.ts`: validar configuração/opção do radar somente quando preenchido; preservar permissão, destino e transação.
- [x] Atualizar testes de cadastro/modal e catálogo compartilhado para cobrir opções, customização, remoção de Qualificação, radar vazio/configurado/inválido e persistência do canal.
- [x] Executar lint, typecheck, testes e build e registrar evidências.

Referências: `DropdownSelecaoComCriacao.tsx` e modal de cadastro de clientes (criação local de opção); modal comercial (canais e labels); `criarCardSchema` (radar já opcional quando omitido). O componente existente de dropdown não oferece select nativo nem limite de texto, por isso será usada composição pequena dedicada ao modal CRM, mantendo o estilo dos controles atuais.

Controles verificados: rota/modal já acessível pelo board; não há nova página, menu, atalho ou permissão. Mantém guardas de CRM/pipeline/responsável e estado de envio. Sem schema, migration, seed ou mutação de dados existentes. Promoção de leads NoLoss e edição de Qualificação em cards existentes não fazem parte deste pedido.

### File List complementar

- `src/lib/comercial/canais-origem.ts`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/origens-lead.ts`
- `src/components/comercial/ModalGerenciamentoLeads.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/SeletorCanalOrigemLead.tsx`
- `tests/comercial/canais-origem.test.ts`

### Verificação do ajuste

- Catálogo único com 13 valores: união dos canais anteriormente disponíveis em Metas e Cadastro de Clientes; rótulos especiais e regras de indicação/prospecção de Metas preservados.
- Canal personalizado é confirmado no seletor e persistido no campo do lead; não altera o catálogo global nem dados existentes.
- `radarPretendido` já é opcional em `criarCardSchema`; o modal agora omite o valor vazio e a action só exige configuração/opção válida quando informado. Qualificação deixou de ser exibida e enviada pelo modal, mantendo compatibilidade dos demais fluxos.
- Testes direcionados: 4 arquivos / 43 testes passaram (modal, action, catálogo e origens no cadastro de clientes).
- `npm run lint`: passou, 0 erros e 1193 warnings existentes.
- `npm run typecheck`: passou.
- `npm test`: 650 arquivos passaram; 4883 testes passaram, 4 skipped e 1 todo.
- `npm run build`: passou na repetição após limpeza do cache de build da worktree; primeira tentativa falhou por cota de disco do ambiente.
- ESLint focado e `git diff --check`: passaram.
- CodeRabbit CLI indisponível neste ambiente. Logs: `/tmp/crm-cadastro-lead-*.log`.
