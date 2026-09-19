import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const actions = readFileSync(resolve(process.cwd(), "src/actions/Estoque.ts"), "utf8");
const itemService = readFileSync(resolve(process.cwd(), "src/lib/estoque/items-service.ts"), "utf8");
const authorization = readFileSync(resolve(process.cwd(), "src/lib/estoque/authorization.ts"), "utf8");
const legacyRoute = readFileSync(resolve(process.cwd(), "src/app/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque/page.tsx"), "utf8");
const inventoryCli = readFileSync(resolve(process.cwd(), "scripts/inventory/cli.ts"), "utf8");

describe("estoque safety contracts", () => {
  it("não permite que edição cadastral atualize quantidade", () => {
    const updateBranch = itemService.slice(
      itemService.indexOf("if (data.id)"),
      itemService.indexOf("const created =", itemService.indexOf("if (data.id)")),
    );
    expect(updateBranch).not.toContain("quantidade:");
  });

  it("bloqueia criação com saldo inicial antes do ledger", () => {
    expect(itemService).toContain("!data.id && data.quantidade > 0");
    expect(itemService).toContain("quantidade: 0");
  });

  it("delega cadastro e arquivamento ao serviço compartilhado", () => {
    expect(actions).toContain("saveInventoryItem(payload");
    expect(actions).toContain("archiveInventoryItem(id");
  });

  it("edita categorias com auditoria e devolve o registro autoritativo", () => {
    const categoryAction = actions.slice(actions.indexOf("export async function SalvarCategoria"), actions.indexOf("export async function buscarCategorias"));
    expect(categoryAction).toContain('acao: "ESTOQUE_CATEGORIA_EDITADA"');
    expect(categoryAction).toContain("anterior:");
    expect(categoryAction).toContain("novo:");
    expect(categoryAction).toContain("data: category");
  });

  it("não incrementa compra diretamente no cache legado", () => {
    const purchaseAction = actions.slice(actions.indexOf("export async function RegistrarCompra"), actions.indexOf("const cartProductSchema"));
    expect(purchaseAction).not.toContain("increment:");
    expect(purchaseAction).toContain("recordInventoryPurchase");
    expect(purchaseAction).toContain("idempotencyKey");
    expect(purchaseAction).toContain('source: "LISTA_COMPRA"');
  });

  it("revalida usuário ativo e role atual antes de autorizar", () => {
    expect(authorization).toContain("db.usuarios.findFirst");
    expect(authorization).toContain('status: "ATIVO"');
    expect(authorization).toContain("canManageInventory(user.role)");
    expect(authorization).toContain("canConfirmInventoryReturns(user.role)");
    expect(authorization).toContain("requireInventoryReturnApprover");
  });

  it("deriva o snapshot do carrinho do produto ativo persistido", () => {
    const cartAction = actions.slice(actions.indexOf("const cartProductSchema"), actions.indexOf("export async function ConfirmarCarrinhoParaLista"));
    expect(cartAction).toContain("tx.produtoEstoque.findFirst");
    expect(cartAction).toContain("archivedAt: null");
    expect(cartAction).toContain("nome: product.nome");
    expect(cartAction).toContain("quantidadeAtual: product.quantidade");
    expect(cartAction).not.toContain("nome: z.string");
    expect(cartAction).not.toContain("quantidade: nonNegativeInteger");
  });

  it("mantém a rota antiga como redirect para a rota canônica", () => {
    expect(legacyRoute).toContain('redirect("/PainelAlpha/Estoque")');
  });

  it("faz o CLI mutável respeitar os setores de gestão do estoque", () => {
    expect(inventoryCli).toContain("canManageInventory(user.role)");
    expect(inventoryCli).not.toContain("JSON.parse(user.permissoes");
  });

  it("exige confirmação explícita nas exclusões definitivas do CLI", () => {
    expect(inventoryCli).toContain('case "item-delete"');
    expect(inventoryCli).toContain('case "tag-delete"');
    expect(inventoryCli).toContain('stringFlag(flags, "confirm", true) !== "EXCLUIR"');
  });
});
