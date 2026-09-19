import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const service = readFileSync(resolve(process.cwd(), "src/lib/estoque/movement-service.ts"), "utf8");

describe("inventory ledger service safety contract", () => {
  it("mantém operação, saldo, cache, movimento e auditoria dentro da mesma transação", () => {
    expect(service).toContain("client.$transaction(work)");
    expect(service).toContain("inventoryOperation.create");
    expect(service).toContain("inventoryStockBalance.updateMany");
    expect(service).toContain("produtoEstoque.update");
    expect(service).toContain("inventoryMovement.create");
    expect(service).toContain("inventoryAuditLog.create");
  });

  it("usa CAS e pré-condição de saldo para impedir saldo negativo e lost update", () => {
    expect(service).toContain("version: balance.version");
    expect(service).toContain("quantity: { gte: quantity }");
    expect(service).toContain('"INSUFFICIENT_STOCK"');
    expect(service).toContain('"CONCURRENT_UPDATE"');
  });

  it("deduplica pela chave e rejeita reuso com payload divergente", () => {
    expect(service).toContain("idempotencyKey");
    expect(service).toContain("requestHash");
    expect(service).toContain('"IDEMPOTENCY_CONFLICT"');
  });

  it("não contém chamada de execução automática ou seed de produção", () => {
    expect(service).not.toContain("main()");
    expect(service).not.toContain("createMany({ data:");
  });
});
