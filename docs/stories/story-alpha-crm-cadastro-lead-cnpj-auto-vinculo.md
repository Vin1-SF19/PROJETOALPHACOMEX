# Story: corrigir cadastro de lead e vínculo automático por CNPJ

## Status

InProgress

## Story

Como usuário do Alpha CRM, quero cadastrar um lead na etapa `Novo Lead` de Revisão de Radar e, ao informar um CNPJ já cadastrado, ter a empresa vinculada e os seus dados preenchidos automaticamente, sem selecionar uma sugestão pelo nome fantasia.

## Contexto

A etapa inicial foi persistida pelo editor de pipelines com ID `draft-stage-<uuid>`. O schema `criarCardSchema` aceita somente CUID para `etapaId`, rejeita o payload antes da gravação e o board converte o erro estruturado na mensagem genérica `Erro ao criar card`. O modal atual busca empresas quando se digita a razão social, mas, ao completar o CNPJ, consulta apenas a Receita Federal e mantém `empresaSelecionada` nula. Assim, um CNPJ existente tenta criar outro Cliente.

## Critérios de aceitação

1. [x] `CriarCardBpm` aceita o ID de etapa `draft-stage-<uuid>` persistido pelo editor, preservando as verificações de pipeline, etapa inicial ativa, responsável e transação; não aceita ID arbitrário.
2. [x] Ao completar um CNPJ, o modal consulta primeiro o Cliente existente por CNPJ normalizado ou formatado. Se encontrado, seleciona o ID automaticamente e mostra razão social, nome fantasia, UF e município do cadastro, sem clique em sugestão.
3. [x] Quando o CNPJ não existe no banco, o fluxo atual de consulta à Receita Federal e criação de nova empresa continua disponível.
4. [x] Alterar o CNPJ cancela a seleção anterior; resposta atrasada de consulta não troca a empresa escolhida nem sobrescreve edição posterior.
5. [x] Falha de consulta interna é apresentada de modo claro. O servidor mantém a proteção contra duplicação de CNPJ e o vínculo usa `empresaId` quando há Cliente existente.
6. [x] Nenhuma migration, seed, backfill ou mutação em massa é feita.
7. [ ] Testes focados e gates `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` são executados, com checklist e File List atualizados.

## Checklist

- [x] Identificar a causa do erro e o fluxo atual de CNPJ.
- [x] Ajustar schema, busca interna e modal.
- [ ] Validar os dois caminhos de cadastro, existente e novo, e os gates.

## Verificação parcial

- Testes focados: `tests/bpm/criar-card-nova-empresa.test.ts`, `tests/bpm/novo-card-modal-react.test.ts` e `tests/bpm/cnpj-mascara.test.ts` passaram (53 testes antes do caso adicional de ID inválido).
- `npm run typecheck` passou após a implementação.

## File List

- `docs/stories/story-alpha-crm-cadastro-lead-cnpj-auto-vinculo.md`
- `src/lib/validations/bpm.ts`
- `src/actions/bpm/CardsConsultas.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `tests/bpm/criar-card-nova-empresa.test.ts`
- `tests/bpm/novo-card-modal-react.test.ts`
