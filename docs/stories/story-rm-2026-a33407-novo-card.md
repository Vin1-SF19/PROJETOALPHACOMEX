# RM-2026-A33407 — Modal Novo Card

## Entrega

O modal do Kanban usa um formulário único para CNPJ, razão social, nome fantasia, município e UF. A razão social busca empresas existentes; a seleção vincula o card à empresa escolhida. Um CNPJ completo consulta a Receita Federal e preenche os campos para cadastro de empresa nova. A criação continua pela ação existente `CriarCardBpm` no fluxo do board.

Na revalidação de 2026-09-23, uma resposta atrasada da consulta por CNPJ podia sobrescrever uma edição posterior ou a seleção de empresa existente. A busca agora descarta respostas antigas quando o usuário altera os dados, escolhe outra empresa ou fecha o modal. O autocomplete também ignora resultados de consultas antigas. A asserção textual do teste de integração foi alinhada ao payload atual.

## Evidências

- `tests/bpm/novo-card-modal-react.test.ts` e `tests/bpm/card-modal-integration.test.ts`: 24/24 testes aprovados.
- ESLint dos arquivos alterados: exit 0.
- `npm run typecheck`: exit 0.
- `git diff --check` dos arquivos rastreados alterados: exit 0.

## Próxima etapa

Homologar no navegador autenticado a seleção de empresa, o preenchimento por CNPJ e a criação do card. O staging automático permanece bloqueado pela árvore compartilhada com logs e mudanças de outras RMs; nenhuma publicação foi executada nesta revalidação.

## Arquivos

- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `tests/bpm/novo-card-modal-react.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
