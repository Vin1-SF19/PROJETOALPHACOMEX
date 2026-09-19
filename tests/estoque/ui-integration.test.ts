import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string): string {
  return readFileSync(resolve(process.cwd(), file), "utf8");
}

describe("integração da central de estoque", () => {
  it("conecta as quatro abas às views reais", () => {
    const workspace = source("src/components/Estoque/InventoryWorkspace.tsx");
    expect(workspace).toContain("<InventoryKitsPanel");
    expect(workspace).toContain("<InventoryAssignmentsPanel");
    expect(workspace).toContain("<InventoryMovementsPanel");
    expect(workspace).toContain("<InventoryMaintenancePanel");
  });

  it("mantém as ações principais do cabeçalho habilitadas", () => {
    const header = source("src/components/Estoque/InventoryHeader.tsx");
    expect(header).toContain("onClick={onNewKit}");
    expect(header).toContain("onClick={onMove}");
    expect(header).not.toContain("Movimentações dependem do ledger aprovado");
  });

  it("usa exclusivamente actions transacionais nas operações da UI", () => {
    const modal = source("src/components/Estoque/InventoryMovementModal.tsx");
    expect(modal).toContain("MovimentarEstoque");
    expect(modal).toContain("AtribuirItemEstoque");
    expect(modal).toContain("EnviarItemManutencao");
    expect(modal).not.toContain("produtoEstoque.update");
  });

  it("expõe devolução, unidade patrimonial e retorno de manutenção", () => {
    expect(source("src/components/Estoque/InventoryAssignmentsPanel.tsx")).toContain("DevolverItemEstoque");
    expect(source("src/components/Estoque/InventoryAssetModal.tsx")).toContain("CadastrarUnidadePatrimonial");
    expect(source("src/components/Estoque/InventoryMaintenancePanel.tsx")).toContain("RetornarItemManutencao");
  });

  it("direciona entrada individual para o cadastro patrimonial", () => {
    const modal = source("src/components/Estoque/InventoryMovementModal.tsx");
    expect(modal).toContain('type === "ENTRADA" && item?.trackingMode === "INDIVIDUAL"');
    expect(modal).toContain("Cadastrar unidade patrimonial");
    expect(modal).toContain("individualEntry");
  });

  it("consulta e pagina os itens no servidor", () => {
    const browser = source("src/components/Estoque/InventoryItemsBrowser.tsx");
    expect(browser).toContain("BuscarItensEstoque");
    expect(browser).toContain("page.nextCursor");
    expect(browser).toContain("Carregar mais itens");
    expect(browser).toContain("Busca e filtros processados no servidor");
    expect(browser).toContain('"LOW_STOCK"');
  });

  it("mantém o SSR limitado e usa resumo agregado independente da página", () => {
    const page = source("src/app/PainelAlpha/Estoque/page.tsx");
    const actions = source("src/actions/Estoque.ts");
    expect(page).toContain("buscarProdutos({ limit: 30 })");
    expect(page).toContain("buscarResumoEstoque()");
    expect(page).toContain("summary={summary}");
    expect(actions).toContain("COUNT(*) AS itensCadastrados");
    expect(actions).toContain("quantidade <= estoqueMinimo");
  });

  it("preserva o gerenciamento simples de categorias", () => {
    const manager = source("src/components/Estoque/InventoryCategoryManager.tsx");
    const workspace = source("src/components/Estoque/InventoryWorkspace.tsx");
    expect(manager).toContain("SalvarCategoria");
    expect(manager).toContain("DeletarCategoria");
    expect(manager).toContain("Editar categoria");
    expect(manager).toContain("onCategoriesChange");
    expect(manager).not.toContain("router.refresh()");
    expect(workspace).toContain("<InventoryCategoryManager");
    expect(workspace).toContain("availableCategories");
  });

  it("explica os fluxos principais sem transformar a página em dashboard", () => {
    const workspace = source("src/components/Estoque/InventoryWorkspace.tsx");
    const guide = source("src/components/Estoque/InventoryGettingStarted.tsx");
    expect(workspace).toContain("<InventoryGettingStarted");
    expect(guide).toContain("Como usar o Estoque Alpha");
    expect(guide).toContain("Cadastre o item");
    expect(guide).toContain("Registre cada movimento");
    expect(guide).toContain("Monte Tags e Kits");
  });

  it("permite buscar além do recorte inicial do catálogo de Tags e Kits", () => {
    const panel = source("src/components/Estoque/kits/InventoryKitsPanel.tsx");
    expect(panel).toContain("productQuery: query");
    expect(panel).toContain("Buscar item para composição");
    expect(panel).toContain("result.data.products.filter");
  });

  it("explicita produto, quantidade e obrigatoriedade na composição do modelo", () => {
    const editor = source("src/components/Estoque/kits/TagKitEditor.tsx");
    expect(editor).toContain("Produto / item");
    expect(editor).toContain("Quantidade necessária");
    expect(editor).toContain("Obrigatoriedade");
    expect(editor).toContain("Disponível agora:");
    expect(editor).toContain('value="OPCIONAL"');
  });

  it("usa seletor visual compartilhado com pelo menos vinte ícones", () => {
    const selector = source("src/components/Estoque/InventoryIconSelect.tsx");
    expect(selector).toContain("Escolha um ícone");
    expect(selector.match(/name: "/g)?.length).toBeGreaterThanOrEqual(20);
    expect(source("src/components/Estoque/InventoryCategoryManager.tsx")).toContain("<InventoryIconSelect");
    expect(source("src/components/Estoque/kits/TagKitEditor.tsx")).toContain("<InventoryIconSelect");
  });

  it("permite anexar nota fiscal compacta e movimentar item ou kit", () => {
    const form = source("src/components/Estoque/InventoryItemForm.tsx");
    const modal = source("src/components/Estoque/InventoryMovementModal.tsx");
    expect(form).toContain("Nota fiscal");
    expect(form).toContain("uploadInventoryInvoice");
    expect(modal).toContain('setEntityType("ITEM")');
    expect(modal).toContain('setEntityType("KIT")');
    expect(modal).toContain("Alpha Comex & Compliance");
    expect(modal).toContain("destinationLabel");
  });

  it("explica disponibilidade e faltantes no detalhe do kit", () => {
    const panel = source("src/components/Estoque/kits/InventoryKitsPanel.tsx");
    expect(panel).toContain("inventoryKitAvailability");
    expect(panel).toContain("kit(s) completo(s) podem ser montados agora");
    expect(panel).toContain("Estoque perto do limite");
    expect(panel).toContain("Kit indisponível");
    expect(panel).toContain("availability.completeKitsPossible");
    expect(panel).toContain("disponível(is) agora");
  });

  it("oferece visão pessoal e restringe a confirmação de devolução ao TI", () => {
    const workspace = source("src/components/Estoque/InventoryWorkspace.tsx");
    const assignments = source("src/components/Estoque/InventoryAssignmentsPanel.tsx");
    const movements = source("src/components/Estoque/InventoryMovementsPanel.tsx");
    const kitBuilder = source("src/components/Estoque/kits/KitBuilder.tsx");
    expect(workspace).toContain("Itens em sua posse");
    expect(workspace).toContain("Minha posse");
    expect(workspace).toContain("mineOnly");
    expect(assignments).toContain('scope: mineOnly ? "MINE" : "ALL"');
    expect(movements).toContain('scope: mineOnly ? "MINE" : "ALL"');
    expect(kitBuilder).toContain("Somente usuários do setor TI");
  });

  it("mantém quantidade padrão igual a um para item e kit", () => {
    const movement = source("src/components/Estoque/InventoryMovementModal.tsx");
    const kitBuilder = source("src/components/Estoque/kits/KitBuilder.tsx");
    expect(movement).toContain('useState("1")');
    expect(movement).toContain('setQuantity("1")');
    expect(kitBuilder).toContain('aria-label="Quantidade de kits"');
    expect(kitBuilder).toContain('value="1"');
  });

  it("limita consumidores legados do catálogo por padrão", () => {
    const actions = source("src/actions/Estoque.ts");
    expect(actions).toContain("options.limit ?? 200");
    expect(actions).toContain("take: limit");
  });

  it("arquiva itens sem exclusão física e mantém auditoria", () => {
    const details = source("src/components/Estoque/InventoryItemDetails.tsx");
    const actions = source("src/actions/Estoque.ts");
    const itemService = source("src/lib/estoque/items-service.ts");
    expect(details).toContain("ArquivarProduto");
    expect(actions).toContain("archiveInventoryItem(id");
    expect(itemService).toContain("const archivedAt = new Date()");
    expect(itemService).toContain('action: "ESTOQUE_ITEM_ARQUIVADO"');
    expect(itemService).toContain("inventoryAssignment.count");
    expect(itemService).toContain("inventoryMaintenance.count");
  });

  it("expõe exclusão definitiva separada de baixa e arquivamento", () => {
    const details = source("src/components/Estoque/InventoryItemDetails.tsx");
    const kitPanel = source("src/components/Estoque/kits/InventoryKitsPanel.tsx");
    const actions = source("src/actions/Estoque.ts");
    const kitActions = source("src/actions/EstoqueKits.ts");
    expect(details).toContain("Excluir definitivamente");
    expect(details).toContain("ExcluirProdutoDefinitivamente");
    expect(kitPanel).toContain("excluirTagKitDefinitivamente");
    expect(kitPanel).toContain("Digite EXCLUIR");
    expect(actions).toContain("deleteInventoryItemPermanently");
    expect(kitActions).toContain("deleteInventoryTagModelPermanently");
  });
});
