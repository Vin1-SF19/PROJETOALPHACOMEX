import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { camposPrivadosPrisma } from "@/lib/prisma";

it("consultas padrão e relações não expõem supervisores, mas selects explícitos continuam funcionando", async () => {
  const dir = mkdtempSync(join(tmpdir(), "crm-config-omit-"));
  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url: `file:${join(dir, "test.db")}` }), omit: camposPrivadosPrisma });
  try {
    await db.$executeRawUnsafe('CREATE TABLE BpmPipeline (id TEXT PRIMARY KEY, chave TEXT, nome TEXT NOT NULL, ordem INTEGER NOT NULL, ativo BOOLEAN NOT NULL, configVersion INTEGER NOT NULL, visualizacaoConfigJson TEXT, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)');
    await db.$executeRawUnsafe('CREATE TABLE BpmPipelineSetor (id TEXT PRIMARY KEY, pipelineId TEXT NOT NULL, setorId INTEGER NOT NULL)');
    const config = JSON.stringify({ version: 1, supervisores: [{ usuarioId: 7, setorIds: [3] }] });
    await db.bpmPipeline.create({ data: { id: "p", nome: "Pipeline", visualizacaoConfigJson: config } });
    await db.bpmPipelineSetor.create({ data: { id: "s", pipelineId: "p", setorId: 3 } });
    const normal = await db.bpmPipeline.findUnique({ where: { id: "p" } });
    expect(normal).not.toHaveProperty("visualizacaoConfigJson");
    const nested = await db.bpmPipelineSetor.findUnique({ where: { id: "s" }, include: { pipeline: true } });
    expect(nested?.pipeline).not.toHaveProperty("visualizacaoConfigJson");
    expect(await db.bpmPipeline.findUnique({ where: { id: "p" }, select: { visualizacaoConfigJson: true } })).toEqual({ visualizacaoConfigJson: config });
    await db.$transaction(async (tx) => {
      expect(await tx.bpmPipeline.findUnique({ where: { id: "p" } })).not.toHaveProperty("visualizacaoConfigJson");
      expect(await tx.bpmPipeline.findUnique({ where: { id: "p" }, select: { visualizacaoConfigJson: true } })).toEqual({ visualizacaoConfigJson: config });
    });
  } finally { await db.$disconnect(); rmSync(dir, { recursive: true, force: true }); }
});
