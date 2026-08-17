import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  productionConfigSchema,
  productionStateSchema,
  type ProductionConfig,
  type ProductionState,
} from "@/lib/roadmap-production/contracts";

const STATE_DIRECTORY = ".roadmap-production";
const CONFIG_FILE = "config.json";
const STATE_FILE = "state.json";

function directory(root = process.cwd()): string {
  return path.resolve(root, STATE_DIRECTORY);
}

function emptyState(): ProductionState {
  return { version: 1, updatedAt: new Date().toISOString(), executions: [] };
}

function defaultConfig(): ProductionConfig {
  return {
    version: 1,
    provider: "ollama",
    model: process.env.ROADMAP_QWEN_MODEL?.trim() || "qwen3.8:27b",
    autoRun: true,
    maxToolSteps: 24,
    updatedAt: new Date().toISOString(),
  };
}

async function readJsonWithRetry(filePath: string): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error("LOCAL_STATE_READ_FAILED");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${randomUUID()}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  try {
    await fs.rm(filePath, { force: true });
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

export async function readProductionConfig(root = process.cwd()): Promise<ProductionConfig> {
  const filePath = path.join(directory(root), CONFIG_FILE);
  try {
    return productionConfigSchema.parse(await readJsonWithRetry(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("INVALID_PRODUCTION_CONFIG");
    const config = defaultConfig();
    await writeJson(filePath, config);
    return config;
  }
}

export async function writeProductionConfig(
  input: Omit<ProductionConfig, "updatedAt">,
  root = process.cwd(),
): Promise<ProductionConfig> {
  const config = productionConfigSchema.parse({ ...input, updatedAt: new Date().toISOString() });
  await writeJson(path.join(directory(root), CONFIG_FILE), config);
  return config;
}

export async function readProductionState(root = process.cwd()): Promise<ProductionState> {
  const filePath = path.join(directory(root), STATE_FILE);
  try {
    return productionStateSchema.parse(await readJsonWithRetry(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("INVALID_PRODUCTION_STATE");
    return emptyState();
  }
}

export async function writeProductionState(state: ProductionState, root = process.cwd()): Promise<void> {
  const parsed = productionStateSchema.parse({ ...state, updatedAt: new Date().toISOString() });
  await writeJson(path.join(directory(root), STATE_FILE), parsed);
}

export function productionStateDirectory(root = process.cwd()): string {
  return directory(root);
}
