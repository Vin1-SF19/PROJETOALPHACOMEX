import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { inventoryBlobConsumers, runStorageInventory } from "@/lib/storage/inventory";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("storage:inventory", () => {
  it("classifica client/server, operações e tokens sem ler seus valores", () => {
    const root = mkdtempSync(path.join(tmpdir(), "storage-inventory-"));
    temporaryDirectories.push(root);
    mkdirSync(path.join(root, "src", "app", "PainelAlpha", "GerenciamentoArquivos"), { recursive: true });
    mkdirSync(path.join(root, "src", "app", "api", "other"), { recursive: true });
    writeFileSync(
      path.join(root, "src", "app", "PainelAlpha", "GerenciamentoArquivos", "page.tsx"),
      `'use client';\nimport { upload } from '@vercel/blob/client';\nupload('x', new Blob(), {});`,
    );
    writeFileSync(
      path.join(root, "src", "app", "api", "other", "route.ts"),
      `import { put } from '@vercel/blob';\nconst token = process.env.CUSTOM_BLOB_TOKEN;\nput('x', 'x', { token });`,
    );

    const result = inventoryBlobConsumers(root);
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.flow === "client")).toMatchObject({
      logicalStorage: "documentos",
      operations: ["upload"],
    });
    expect(result.find((item) => item.flow === "server")).toMatchObject({
      logicalStorage: "unclassified",
      tokenVariables: ["CUSTOM_BLOB_TOKEN"],
    });
    expect(JSON.stringify(result)).not.toContain("token-value");
  });

  it("encontra os consumidores reais sem modificar o projeto", () => {
    const result = runStorageInventory(process.cwd(), () => new Date("2026-08-18T12:00:00.000Z"));
    expect(result).toMatchObject({ ok: true, command: "inventory", code: 0 });
    const consumers = result.checks.consumers as Array<{ file: string }>;
    expect(consumers.some((item) => item.file === "src/app/api/upload/route.ts")).toBe(true);
    expect(consumers.some((item) => item.file.includes("GerenciamentoArquivos/page.tsx"))).toBe(true);
  });
});
