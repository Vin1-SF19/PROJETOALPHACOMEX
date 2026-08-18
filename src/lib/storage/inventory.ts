import "server-only";

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import type { StorageCommandResult } from "@/lib/storage/contracts";

export interface BlobConsumerInventoryItem {
  file: string;
  logicalStorage: "documentos" | "alpha-motion" | "bibble" | "blueprint" | "skills" | "unclassified";
  flow: "client" | "server";
  operations: string[];
  tokenVariables: string[];
}

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) files.push(...walk(absolute));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry))) files.push(absolute);
  }
  return files;
}

function importedBlobOperations(source: string): { client: boolean; operations: string[] } {
  const operations = new Set<string>();
  let client = false;
  const importPattern = /import\s*{([^}]+)}\s*from\s*["'](@vercel\/blob(?:\/client)?)["']/g;
  for (const match of source.matchAll(importPattern)) {
    client ||= match[2].endsWith("/client");
    for (const rawSpecifier of match[1].split(",")) {
      const specifier = rawSpecifier.trim().replace(/^type\s+/, "");
      if (!specifier) continue;
      const [imported, local = imported] = specifier.split(/\s+as\s+/).map((value) => value.trim());
      if (new RegExp(`\\b${local}\\s*\\(`).test(source)) operations.add(imported);
    }
  }
  return { client, operations: [...operations].sort() };
}

function inferLogicalStorage(relativePath: string): BlobConsumerInventoryItem["logicalStorage"] {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  if (normalized.includes("gerenciamentoarquivos") || normalized.endsWith("/actions/uploaddocs.ts")) return "documentos";
  if (normalized.includes("/apresentacoes/") || normalized.includes("alpha-motion")) return "alpha-motion";
  if (normalized.includes("/bibble/")) return "bibble";
  if (normalized.includes("/blueprint/")) return "blueprint";
  if (normalized.includes("alphaskills") || normalized.includes("uploadskills")) return "skills";
  return "unclassified";
}

export function inventoryBlobConsumers(projectRoot = process.cwd()): BlobConsumerInventoryItem[] {
  const sourceRoot = path.join(projectRoot, "src");
  const items: BlobConsumerInventoryItem[] = [];

  for (const absolutePath of walk(sourceRoot)) {
    const source = readFileSync(absolutePath, "utf8");
    if (!source.includes("@vercel/blob")) continue;

    const relativePath = path.relative(projectRoot, absolutePath).replaceAll("\\", "/");
    if (relativePath.startsWith("src/lib/storage/")) continue;
    const imports = importedBlobOperations(source);
    const tokenVariables = Array.from(source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*(?:BLOB|MOTION)[A-Z0-9_]*)/g))
      .map((match) => match[1])
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort();

    items.push({
      file: relativePath,
      logicalStorage: inferLogicalStorage(relativePath),
      flow: imports.client ? "client" : "server",
      operations: imports.operations,
      tokenVariables,
    });
  }

  return items.sort((left, right) => left.file.localeCompare(right.file));
}

export function runStorageInventory(
  projectRoot = process.cwd(),
  now: () => Date = () => new Date(),
): StorageCommandResult {
  try {
    const consumers = inventoryBlobConsumers(projectRoot);
    const clientCount = consumers.filter((item) => item.flow === "client").length;
    return {
      ok: true,
      command: "inventory",
      code: 0,
      checks: {
        consumers,
        summary: {
          total: consumers.length,
          client: clientCount,
          server: consumers.length - clientCount,
          unclassified: consumers.filter((item) => item.logicalStorage === "unclassified").length,
        },
      },
      timestamp: now().toISOString(),
    };
  } catch {
    return {
      ok: false,
      command: "inventory",
      code: 2,
      checks: { inventory: { ok: false, errorCode: "INVENTORY_FAILED" } },
      timestamp: now().toISOString(),
    };
  }
}
