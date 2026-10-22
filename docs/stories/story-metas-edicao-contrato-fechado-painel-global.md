# Story: Abrir edição de contrato fechado no painel global do Alpha Metas

**Módulo:** Alpha Metas — Gestão Comercial
**Tipo:** Correção

## Contexto

No painel global de Gestão Comercial, clicar na razão social de um contrato fechado deve abrir um modal com o formulário de edição desse contrato. A edição não deve aparecer embutida no topo do painel nem ser confundida com o cadastro de um novo cliente.

## Critérios de aceite

1. [x] Ao clicar na razão social de um contrato fechado, um modal exibe o formulário de edição do contrato clicado.
2. [x] A edição mantém o contrato clicado como dados iniciais e preserva as demais ações da tabela de contratos fechados.
3. [x] O modal pode ser fechado pelo botão, clique fora ou tecla Escape, além das ações Salvar e Cancelar do formulário.

## Implementação

- O handler da tabela de contratos fechados fecha o estado de criação e define o contrato clicado em edição.
- O formulário de edição é exibido em uma camada modal com rolagem própria e controles de fechamento acessíveis.
- O botão de razão social anuncia sua ação com título e nome acessível.

## Arquivos

- `src/components/comercial/ModalGerenciamentoLeads.tsx` — corrigido o fluxo de edição e identificada a ação do botão.
- `docs/stories/story-metas-edicao-contrato-fechado-painel-global.md` — story da correção.

## Validação

- [x] `npm run lint -- src/components/comercial/ModalGerenciamentoLeads.tsx`
- [x] `npm run typecheck`
- [ ] `npm test`
