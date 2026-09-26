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
- Candidato isolado a partir de `origin/main`: testes focados em 4 arquivos, 34 testes passaram.
- `npm run lint`: passou com 0 erros e 1.192 avisos preexistentes.
- `npm run typecheck`: passou após gerar o bundle local do player de apresentações, ignorado pelo Git.
- `npm run build` fora do sandbox: passou.
- A suíte inicial identificou que `tests/debug/error-bus.test.ts` exigia ambiente com `window`. O arquivo recebeu somente a diretiva `@vitest-environment happy-dom` para declarar seu ambiente de execução.
- Teste focado de debug: 1 arquivo, 3 testes passaram.
- `npm test` fora do sandbox, após a diretiva: 530 arquivos passaram; 3.916 testes passaram, 4 ignorados e 1 pendente. Os testes de CLI passaram fora do sandbox.

## File List

- `docs/stories/story-alpha-crm-cadastro-novo-lead-revisao-radar.md`
- `src/lib/bpm/novos-leads.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `tests/bpm/novos-leads.test.ts`
- `tests/bpm/criar-card-nova-empresa.test.ts`
- `tests/bpm/novo-card-modal-react.test.ts`
- `tests/debug/error-bus.test.ts` — diretiva de ambiente exigida pelo gate completo.
