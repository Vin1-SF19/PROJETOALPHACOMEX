# IDS — Estoque Geral / fotos e UI

| Arquivo | Decisão | Evidência pesquisada / justificativa |
| --- | --- | --- |
| `src/lib/estoque/images.ts` | ADAPT | Reutiliza assinaturas e validação de `src/lib/avatar-upload.ts`, ampliando a checagem de extensão e confinando chaves ao prefixo do estoque. |
| `src/lib/estoque/images-server.ts` | ADAPT | Reutiliza o `sharp` já instalado e empregado pelo módulo de apresentações para decodificar, limitar pixels/dimensões e normalizar fotos; nenhuma dependência foi adicionada. |
| `src/lib/estoque/images-client.ts` | CREATE | Não havia cliente de upload do estoque; encapsula o endpoint único sem criar provider/storage paralelo. |
| `src/app/api/estoque/itens/[itemId]/imagem/route.ts` | ADAPT | Segue os handlers de avatar e miniatura existentes, acrescentando autorização do estoque, vínculo `InventoryImage`, troca segura e proteção de URLs legadas. |
| `src/actions/Estoque.ts` | ADAPT | Amplia a action legada preservada; mantém criação com saldo zero, edição sem quantidade/status e auditoria existente. |
| `src/components/Estoque/InventoryItemForm.tsx` | ADAPT | Evolui o formulário base já criado para fluxo rápido/avançado, preview e campos aditivos, sem duplicar tela. |
| `src/components/Estoque/InventoryItemDetails.tsx` | ADAPT | Evolui o drawer existente com dados reais e usa o otimizador Next para imagens gerenciadas já limitadas no servidor. |
| `src/components/Estoque/InventoryItemsTable.tsx` | ADAPT | Preserva a lista existente e entrega thumbnail lazy/dimensionada pelo otimizador Next para Blob, mantendo fallback compatível com URL legada. |
| `src/components/Estoque/InventoryWorkspace.tsx` | ADAPT | Mantém a composição canônica e adiciona filtros/localização/edição, sem criar rota ou workspace paralelo. |
| `src/lib/estoque/types.ts`, `src/lib/estoque/view-model.ts` | ADAPT | Estendem os contratos já adotados pela rota canônica e mantêm funções puras testáveis. |
| `tests/estoque/images.test.ts`, `tests/estoque/photo-ui-contract.test.ts` | ADAPT | Seguem o padrão Vitest e os contratos estáticos já usados em `tests/estoque/safety-contract.test.ts`. |
