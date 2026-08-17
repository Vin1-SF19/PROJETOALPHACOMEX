import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  developmentProviderSchema,
  productionConfigSchema,
  productionControlCommandSchema,
  productionStateSchema,
  type ProductionConfig,
  type ProductionControlCommand,
  type DevelopmentProvider,
  type ProductionState,
} from "@/lib/roadmap-production/contracts";

const STATE_DIRECTORY = ".roadmap-production";
const CONFIG_FILE = "config.json";
const STATE_FILE = "state.json";
const COMMAND_DIRECTORY = "commands";
const OBJECTIVE_PREFERENCES_FILE = "objective-development-providers.json";

const objectivePreferencesSchema = z
  .object({
    version: z.literal(1),
    objectives: z.record(z.string().min(1).max(120), developmentProviderSchema),
  })
  .strict();

interface ObjectiveDevelopmentPreferences {
  version: 1;
  objectives: Record<string, DevelopmentProvider>;
}

function directory(root = process.cwd()): string {
  return path.resolve(root, STATE_DIRECTORY);
}

function emptyState(): ProductionState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    ignoredExecutionIds: [],
    executions: [],
  };
}

function defaultConfig(): ProductionConfig {
  return {
    version: 1,
    provider: "claude",
    model: "default",
    autoRun: true,
    maxToolSteps: 24,
    updatedAt: new Date().toISOString(),
  };
}

export async function readObjectiveDevelopmentPreferences(
  root = process.cwd(),
): Promise<ObjectiveDevelopmentPreferences> {
  const filePath = path.join(directory(root), OBJECTIVE_PREFERENCES_FILE);
  try {
    return objectivePreferencesSchema.parse(await readJsonWithRetry(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, objectives: {} };
    throw new Error("INVALID_OBJECTIVE_DEVELOPMENT_PREFERENCES");
  }
}

export async function writeObjectiveDevelopmentProvider(
  objectiveId: string,
  provider: DevelopmentProvider,
  root = process.cwd(),
): Promise<void> {
  const parsedId = z.string().min(1).max(120).parse(objectiveId);
  const parsedProvider = developmentProviderSchema.parse(provider);
  const preferences = await readObjectiveDevelopmentPreferences(root);
  preferences.objectives[parsedId] = parsedProvider;
  await writeJson(
    path.join(directory(root), OBJECTIVE_PREFERENCES_FILE),
    preferences,
  );
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
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  try {
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

export async function readProductionConfig(
  root = process.cwd(),
): Promise<ProductionConfig> {
  const filePath = path.join(directory(root), CONFIG_FILE);
  try {
    return productionConfigSchema.parse(await readJsonWithRetry(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("INVALID_PRODUCTION_CONFIG");
    const config = defaultConfig();
    await writeJson(filePath, config);
    return config;
  }
}

export async function writeProductionConfig(
  input: Omit<ProductionConfig, "updatedAt">,
  root = process.cwd(),
): Promise<ProductionConfig> {
  const config = productionConfigSchema.parse({
    ...input,
    updatedAt: new Date().toISOString(),
  });
  await writeJson(path.join(directory(root), CONFIG_FILE), config);
  return config;
}

export async function readProductionState(
  root = process.cwd(),
): Promise<ProductionState> {
  const filePath = path.join(directory(root), STATE_FILE);
  try {
    return productionStateSchema.parse(await readJsonWithRetry(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("INVALID_PRODUCTION_STATE");
    return emptyState();
  }
}

export async function writeProductionState(
  state: ProductionState,
  root = process.cwd(),
): Promise<void> {
  const parsed = productionStateSchema.parse({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  await writeJson(path.join(directory(root), STATE_FILE), parsed);
}

export function productionStateDirectory(root = process.cwd()): string {
  return directory(root);
}

export async function enqueueProductionControl(
  type: ProductionControlCommand["type"],
  executionId: string,
  root = process.cwd(),
  details: {
    phaseNumber?: number;
    feedback?: string;
    improvedWithAi?: boolean;
  } = {},
): Promise<ProductionControlCommand> {
  const command = productionControlCommandSchema.parse({
    id: randomUUID(),
    type,
    executionId,
    phaseNumber: details.phaseNumber ?? null,
    feedback: details.feedback ?? null,
    improvedWithAi: details.improvedWithAi ?? false,
    createdAt: new Date().toISOString(),
  });
  await writeJson(
    path.join(directory(root), COMMAND_DIRECTORY, `${command.id}.json`),
    command,
  );
  return command;
}

export async function readProductionControls(
  root = process.cwd(),
): Promise<Array<{ command: ProductionControlCommand; filePath: string }>> {
  const commandDirectory = path.join(directory(root), COMMAND_DIRECTORY);
  let names: string[];
  try {
    names = (await fs.readdir(commandDirectory))
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const controls: Array<{
    command: ProductionControlCommand;
    filePath: string;
  }> = [];
  for (const name of names) {
    const filePath = path.join(commandDirectory, name);
    try {
      controls.push({
        command: productionControlCommandSchema.parse(
          await readJsonWithRetry(filePath),
        ),
        filePath,
      });
    } catch {
      await fs.rm(filePath, { force: true });
    }
  }
  return controls.sort(
    (left, right) =>
      left.command.createdAt.localeCompare(right.command.createdAt) ||
      left.command.id.localeCompare(right.command.id),
  );
}

export async function removeProductionControlFiles(
  filePaths: string[],
): Promise<void> {
  await Promise.all(
    filePaths.map((filePath) => fs.rm(filePath, { force: true })),
  );
}
