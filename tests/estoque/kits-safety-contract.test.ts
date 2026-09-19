import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(resolve(process.cwd(), "src/actions/EstoqueKits.ts"), "utf8");
const service = readFileSync(resolve(process.cwd(), "src/lib/estoque/kits-service.ts"), "utf8");
const implementation = `${actions}\n${service}`;

describe("inventory kits safety contract", () => {
  it("protege actions com autorização e valida entradas com Zod", () => {
    expect(actions).toContain("requireInventoryManager");
    expect(actions).toContain("requireInventoryReturnApprover");
    expect(service).toContain("saveInventoryTagSchema.parse(payload)");
    expect(actions).toContain("saveInventoryKitComponentsSchema.parse(payload)");
    expect(actions).toContain("saveInventoryTagModel(payload");
  });

  it("audita criação, edição, arquivamento e validação", () => {
    expect(implementation).toContain("INVENTORY_TAG_CREATED");
    expect(implementation).toContain("INVENTORY_TAG_UPDATED");
    expect(implementation).toContain("INVENTORY_TAG_ARCHIVED");
    expect(implementation).toContain("INVENTORY_KIT_INSTANCE_CREATED");
    expect(implementation).toContain("INVENTORY_KIT_COMPONENTS_VALIDATED");
  });

  it("bloqueia dupla alocação e integra entrega/devolução ao batch transacional", () => {
    expect(actions).toContain("já pertence a outro kit ativo");
    expect(actions).toContain("executeInventoryBatchInTransaction(tx");
    expect(actions).toContain('status: "EM_USO"');
    expect(actions).toContain('"DEVOLUCAO_PENDENTE"');
    expect(actions).toContain('"DEVOLVIDO"');
    expect(actions).not.toContain("executeInventoryBatch({");
  });

  it("expõe serviços server-only reutilizáveis pelo CLI sem resolver sessão", () => {
    expect(service).toContain('import "server-only"');
    expect(service).toContain("export async function saveInventoryTagModel");
    expect(service).toContain("export async function createInventoryKitInstance");
    expect(service).toContain("export async function validatePersistedInventoryKit");
    expect(service).not.toContain("requireInventoryActor");
  });
});
