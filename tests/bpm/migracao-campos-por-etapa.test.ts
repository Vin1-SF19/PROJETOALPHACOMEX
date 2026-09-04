import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";

const clientes: ReturnType<typeof createClient>[] = [];

afterEach(async () => {
  await Promise.all(clientes.splice(0).map((client) => client.close()));
});

describe("migração do mapeamento de campos por etapa", () => {
  it("é aditiva e cria todas as dimensões e o armazenamento global", async () => {
    const client = createClient({ url: "file::memory:" });
    clientes.push(client);
    await client.executeMultiple(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE "BpmCampo" ("id" TEXT NOT NULL PRIMARY KEY);
      CREATE TABLE "BpmCampoEtapaConfig" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "campoId" TEXT NOT NULL,
        "etapaId" TEXT NOT NULL,
        "visivel" BOOLEAN NOT NULL DEFAULT true,
        "editavel" BOOLEAN NOT NULL DEFAULT true,
        "somenteLeitura" BOOLEAN NOT NULL DEFAULT false,
        "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
        "ordem" INTEGER NOT NULL DEFAULT 0
      );
    `);
    const sql = await readFile(
      new URL("../../prisma/migrations/20260904210000_bpm_campos_por_etapa/migration.sql", import.meta.url),
      "utf8",
    );
    await client.executeMultiple(sql);

    const etapa = await client.execute('PRAGMA table_info("BpmCampoEtapaConfig")');
    expect(etapa.rows.map((row) => row.name)).toEqual(expect.arrayContaining([
      "grupo",
      "valorPadrao",
      "obrigatorioEntrada",
      "obrigatorioSaida",
      "condicaoVisibilidadeJson",
      "condicaoObrigatoriedadeJson",
    ]));
    const globais = await client.execute('PRAGMA table_info("BpmCampoValorGlobal")');
    expect(globais.rows.map((row) => row.name)).toEqual(expect.arrayContaining([
      "campoId", "entidadeTipo", "entidadeId", "valor",
    ]));
    const integridade = await client.execute("PRAGMA foreign_key_check");
    expect(integridade.rows).toHaveLength(0);
  });
});
