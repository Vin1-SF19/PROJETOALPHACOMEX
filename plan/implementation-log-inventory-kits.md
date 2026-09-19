# IDS — Estoque Tags e Kits

| Arquivo | Busca prévia | Decisão | Justificativa |
|---|---|---|---|
| `src/lib/estoque/kits-domain.ts` | `src/lib/estoque/{types,view-model,movement-domain,movement-schemas}.ts` | CREATE | O domínio de kit não existia; segue Zod e funções puras adotadas pelo domínio de movimentos. |
| `src/lib/estoque/kits-service.ts` | `src/lib/estoque/movement-service.ts`, `src/actions/EstoqueKits.ts` | ADAPT | Separa serviços de aplicação server-only da sessão para reuso por Actions, CLI e jobs, mantendo transação e auditoria únicas. |
| `src/actions/EstoqueKits.ts` | `src/actions/Estoque.ts`, `src/actions/EstoqueMovimentos.ts` | ADAPT | Reutiliza autorização do estoque, Prisma transacional, auditoria e o batch público de movimentos. |
| `src/components/Estoque/kits/InventoryKitsPanel.tsx` | `InventoryWorkspace`, `InventoryEmptyState`, cards e tabs existentes | ADAPT | Mantém linguagem visual e componentes UI do Estoque Alpha, substituindo o empty state sem criar rota paralela. |
| `src/components/Estoque/kits/TagKitEditor.tsx` | `InventoryItemForm`, dialogs/inputs do projeto | ADAPT | Reaproveita o padrão de formulário em modal, com composição específica de Tag/Kit. |
| `src/components/Estoque/kits/KitBuilder.tsx` | `InventoryItemForm`, dialogs/badges e contrato de movimentos | ADAPT | Reaproveita padrões visuais e integra o ledger existente para montagem, entrega e devolução. |
| `tests/estoque/kits-domain.test.ts` | `tests/estoque/{view-model,movement-domain}.test.ts` | ADAPT | Testes Vitest determinísticos para regras puras, limites e estados. |
| `tests/estoque/kits-safety-contract.test.ts` | `tests/estoque/safety-contract.test.ts` | ADAPT | Preserva o padrão de contratos estruturais para auth, auditoria e atomicidade. |
| `plan/self-critique-inventory-kits.json` | checklist AIOX `self-critique-checklist.md` | CREATE | Artefato obrigatório de autocritica 5.5/6.5. |
