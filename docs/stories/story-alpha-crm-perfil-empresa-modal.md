# Story: Perfil da empresa exclusivamente em modal

Status: Ready for Review

## Story

Como usuário do Alpha CRM, quero abrir o perfil consolidado da empresa dentro de um modal do card para consultar seus cards e histórico sem sair do pipeline.

## Acceptance Criteria

1. O botão **Perfil da empresa** no modal do card abre um diálogo, sem navegar para uma página.
2. O diálogo busca o perfil sob demanda, apresenta carregamento, erro recuperável e conteúdo rolável.
3. O perfil apresenta os cards e o histórico consolidados permitidos pela action autorizada.
4. Ao selecionar um card, o diálogo fecha e o modal de card existente abre o card escolhido, sem modal de card aninhado.
5. A rota legada `/PainelAlpha/AlphaCRM/empresa/[empresaId]` redireciona antes de carregar dados.

## Tasks / Subtasks

- [x] Criar modal de perfil com carregamento, erro, retry, scroll e apresentação consolidada.
- [x] Conectar o botão do modal de card ao novo perfil modal.
- [x] Remover a página de perfil e manter a rota antiga apenas como redirecionamento.
- [x] Adicionar cobertura estática de integração e validar os testes BPM focados.

## Dev Agent Record

### Completion Notes

- O perfil continua obtendo dados exclusivamente por `ObterPerfilEmpresaBpm`, que valida permissão CRM/BPM e escopo de cards.
- A seleção de outro card fecha o diálogo de perfil antes de reutilizar `onAbrirCard` do modal principal.

### File List

- `src/app/PainelAlpha/AlphaCRM/CardModal/EmpresaPerfilModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/empresa/[empresaId]/page.tsx`
- `src/app/PainelAlpha/AlphaCRM/empresa/[empresaId]/EmpresaPerfilClient.tsx` (removido)
- `tests/bpm/perfil-empresa-modal.test.ts`

### Change Log

- 2026-08-13: Perfil de empresa movido da rota dedicada para diálogo no modal de card.
