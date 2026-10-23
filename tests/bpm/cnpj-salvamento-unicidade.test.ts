import { expect, it } from "vitest";
import { erroEhCnpjDuplicado } from "@/lib/cnpj/erro-unicidade";

it.each([
  { code: "P2002", meta: { modelName: "Cliente", target: ["cnpj"] } },
  { code: "P2002", meta: { modelName: "Cliente", target: "Cliente_cnpj_key" } },
  { name: "DriverAdapterError", message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: Cliente.cnpj" },
  { cause: { originalCode: "19", originalMessage: 'UNIQUE constraint failed: "Cliente"."cnpj"' } },
  { cause: { kind: "UniqueConstraintViolation", constraint: { fields: ["cnpj"] } } },
])("reconhece somente evidência identificável de CNPJ duplicado: %j", (error) => {
  expect(erroEhCnpjDuplicado(error)).toBe(true);
});
it.each([
  null, new Error("Falha de conexão"), { code: "P2002" }, { code: "P2002", meta: { modelName: "Cliente" } },
  { code: "P2002", meta: { modelName: "BpmCardHistorico", target: ["id"] } },
  { code: "P2002", meta: { modelName: "Cliente", target: ["id"] } },
  { code: "P2002", meta: { modelName: "Cliente", target: ["cnpj", "outro"] } },
  { message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: OutraTabela.cnpj" },
  { message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: Cliente.id" },
  { message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: Cliente.cnpj, Cliente.id" },
  { cause: { kind: "UniqueConstraintViolation", constraint: { fields: ["id"] } } },
])("não oferece vínculo por uma constraint opaca ou diferente: %j", (error) => {
  expect(erroEhCnpjDuplicado(error)).toBe(false);
});
it("não entra em loop em uma cadeia causal circular", () => {
  const error: { cause?: unknown } = {}; error.cause = error;
  expect(erroEhCnpjDuplicado(error)).toBe(false);
});
