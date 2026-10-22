import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { DatabaseSync } from "./node-sqlite";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/** Real isolated database; no dotenv loader and never a remote URL. */
export async function criarFixtureChecklist() {
  const dir = mkdtempSync(join(tmpdir(), "checklist-sage-"));
  const url = `file:${join(dir, "synthetic.db")}`;
  const ddl = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "synthetic" } });
  const sqlite = new DatabaseSync(join(dir, "synthetic.db"));
  sqlite.exec(ddl);
  sqlite.close();
  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  for (const [id, role] of [[1, "Operacional"], [2, "Analista Operacional"], [3, "Líder Operacional"], [4, "Admin"], [5, "CEO"], [6, "TI"], [7, "Líder Comercial"], [8, "Comercial"]] as const) {
    await db.usuarios.create({ data: { id, nome: `Synthetic ${id}`, usuario: `synthetic${id}`, email: `synthetic${id}@example.invalid`, senha: "fixture", role, permissoes: id === 8 ? "" : "checkList" } });
  }
  return {
    db,
    async atendimento(analistaId: number | null = 1) {
      const cliente = await db.cliente.create({ data: { cnpj: randomUUID().replaceAll("-", "").slice(0, 14), razaoSocial: "EMPRESA MASTER LTDA", nomeFantasia: "MASTER", municipio: "São Paulo", uf: "SP", regimeTributario: "Simples Nacional", capitalSocial: "10000", dataConstituicao: "2020-01-01" } });
      const conta = await db.clienteOperacional.create({ data: { nome: "Pessoa da conta", email: `${randomUUID()}@example.invalid`, senha: "", senhaHash: "synthetic" } });
      const empresa = await db.operacionalClientes.create({ data: { clienteId: cliente.id, clienteOperacionalId: conta.id, analistaId, embasamento: "RECEITA_BRUTA_DAS", tipo: "RECEITA_BRUTA_DAS", mesProtocolo: "08/2026", linkGrupo: "https://example.invalid/grupo" } });
      const checklist = await db.checklist.create({ data: { empresaId: empresa.id, tipo: "RECEITA_BRUTA_DAS" } });
      const item = await db.itemChecklist.create({ data: { checklistId: checklist.id, codigo: "DOC", secao: "CONSTITUIÇÃO REGULAR", descricao: "Synthetic item", observacao: "Preservar", obrigatorio: true } });
      return { cliente, conta, empresa, checklist, item };
    },
    async close() { await db.$disconnect(); rmSync(dir, { recursive: true, force: true }); },
  };
}
