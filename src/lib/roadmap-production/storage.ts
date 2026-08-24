import { createHash, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
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
  type ProductionStateInput,
} from "@/lib/roadmap-production/contracts";
import { sanitizeProductionText } from "@/lib/roadmap-production/interactions";

const STATE_DIRECTORY = ".roadmap-production";
const CONFIG_FILE = "config.json";
const STATE_FILE = "state.json";
const COMMAND_DIRECTORY = "commands";
const OBJECTIVE_PREFERENCES_FILE = "objective-development-providers.json";
const LEGACY_MIGRATION_LOCK_FILE = ".legacy-migration-v1.lock";
const LEGACY_MIGRATION_MARKER_FILE = ".legacy-migration-v1.json";

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

function canonicalRoot(root: string): string {
  const absolute = path.resolve(root);
  let resolved = absolute;
  try {
    resolved = realpathSync.native(absolute);
  } catch {
    // Workspaces ainda não materializados mantêm a identidade pelo path absoluto.
  }
  return process.platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
}

function stateHomeDirectory(): string {
  if (process.env.NODE_ENV === "test") {
    return path.join(
      os.tmpdir(),
      "painel-alpha-roadmap-production-tests",
      String(process.pid),
    );
  }
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA?.trim();
    return path.resolve(
      localAppData || path.join(os.homedir(), "AppData", "Local"),
      "PainelAlpha",
      "RoadmapProduction",
    );
  }
  const xdgStateHome = process.env.XDG_STATE_HOME?.trim();
  return path.resolve(
    xdgStateHome || path.join(os.homedir(), ".local", "state"),
    "painel-alpha",
    "roadmap-production",
  );
}

function directory(root = process.cwd()): string {
  const workspaceId = createHash("sha256")
    .update(canonicalRoot(root))
    .digest("hex");
  return path.join(stateHomeDirectory(), "workspaces", workspaceId);
}

function legacyDirectory(root = process.cwd()): string {
  return path.resolve(root, STATE_DIRECTORY);
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertExternalDirectory(root: string, candidate: string): void {
  const workspace = canonicalRoot(root);
  let resolvedCandidate = path.resolve(candidate);
  try {
    resolvedCandidate = realpathSync.native(resolvedCandidate);
  } catch {
    // O diretório pode ainda não existir; a validação é repetida após mkdir.
  }
  const normalizedCandidate =
    process.platform === "win32"
      ? resolvedCandidate.toLocaleLowerCase("en-US")
      : resolvedCandidate;
  if (isInside(workspace, normalizedCandidate)) {
    throw new Error("UNSAFE_PRODUCTION_STATE_DIRECTORY");
  }
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
  await ensureLegacyMigration(root);
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
  await ensureLegacyMigration(root);
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
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.tmp-${randomUUID()}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  try {
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

async function writeJsonIfMissing(
  filePath: string,
  value: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  try {
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

function sanitizeControlCommand(
  command: ProductionControlCommand,
): ProductionControlCommand {
  return productionControlCommandSchema.parse({
    ...command,
    feedback: command.feedback
      ? sanitizeProductionText(command.feedback, 4_000)
      : null,
    content: command.content
      ? sanitizeProductionText(command.content, 4_000)
      : null,
    author: sanitizeProductionText(command.author, 120),
  });
}

function sanitizeState(state: ProductionState): ProductionState {
  return productionStateSchema.parse({
    ...state,
    executions: state.executions.map((execution) => ({
      ...execution,
      completionReportMarkdown: execution.completionReportMarkdown
        ? sanitizeProductionText(execution.completionReportMarkdown, 200_000)
        : null,
      manualFeedback: execution.manualFeedback.map((feedback) => ({
        ...feedback,
        content: sanitizeProductionText(feedback.content, 4_000),
      })),
      messages: execution.messages.map((message) => ({
        ...message,
        content: sanitizeProductionText(message.content, 4_000),
      })),
      interventions: execution.interventions.map((intervention) => ({
        ...intervention,
        question: sanitizeProductionText(intervention.question, 2_000),
        intendedAction: sanitizeProductionText(intervention.intendedAction, 1_000),
        normalizedAction: sanitizeProductionText(intervention.normalizedAction, 1_000),
        risk: sanitizeProductionText(intervention.risk, 2_000),
        options: intervention.options.map((option) =>
          sanitizeProductionText(option, 200),
        ),
        resolution: intervention.resolution
          ? {
              ...intervention.resolution,
              author: sanitizeProductionText(intervention.resolution.author, 120),
              content: sanitizeProductionText(intervention.resolution.content, 4_000),
            }
          : null,
      })),
      phases: execution.phases.map((phase) => ({
        ...phase,
        summary: phase.summary
          ? sanitizeProductionText(phase.summary, 8_000)
          : null,
        errorCode: phase.errorCode
          ? sanitizeProductionText(phase.errorCode, 100)
          : null,
        changedFiles: phase.changedFiles.map((file) =>
          sanitizeProductionText(file, 500),
        ),
        manualFeedback: phase.manualFeedback.map((feedback) => ({
          ...feedback,
          content: sanitizeProductionText(feedback.content, 4_000),
        })),
        circuit: {
          ...phase.circuit,
          resetReason: phase.circuit.resetReason
            ? sanitizeProductionText(phase.circuit.resetReason, 500)
            : null,
        },
        activities: phase.activities.map((activity) => ({
          ...activity,
          message: sanitizeProductionText(activity.message, 2_000),
        })),
      })),
    })),
  });
}

const migrationMarkerSchema = z
  .object({
    version: z.literal(1),
    status: z.enum(["SUCCEEDED", "FAILED"]),
    migratedAt: z.string().datetime(),
    importedFiles: z.array(z.string()).max(3),
    quarantinedLegacyControls: z.number().int().min(0),
    errorCode: z.string().nullable(),
  })
  .strict();

async function readMigrationMarker(
  markerPath: string,
): Promise<z.infer<typeof migrationMarkerSchema> | null> {
  try {
    return migrationMarkerSchema.parse(await readJsonWithRetry(markerPath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("INVALID_PRODUCTION_STATE_MIGRATION");
  }
}

async function countLegacyControls(root: string): Promise<number> {
  try {
    return (await fs.readdir(path.join(legacyDirectory(root), COMMAND_DIRECTORY)))
      .filter((name) => name.endsWith(".json")).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

async function ensureLegacyMigration(root: string): Promise<void> {
  const targetDirectory = directory(root);
  assertExternalDirectory(root, targetDirectory);
  await fs.mkdir(targetDirectory, { recursive: true, mode: 0o700 });
  assertExternalDirectory(root, targetDirectory);
  if (process.platform !== "win32") await fs.chmod(targetDirectory, 0o700);

  const markerPath = path.join(targetDirectory, LEGACY_MIGRATION_MARKER_FILE);
  const existingMarker = await readMigrationMarker(markerPath);
  if (existingMarker) {
    if (existingMarker.status === "FAILED") {
      throw new Error(existingMarker.errorCode ?? "PRODUCTION_STATE_MIGRATION_FAILED");
    }
    return;
  }

  const lockPath = path.join(targetDirectory, LEGACY_MIGRATION_LOCK_FILE);
  let ownsLock = false;
  for (let attempt = 0; attempt < 5 && !ownsLock; attempt += 1) {
    try {
      await fs.writeFile(
        lockPath,
        `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`,
        { encoding: "utf8", flag: "wx", mode: 0o600 },
      );
      ownsLock = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const marker = await readMigrationMarker(markerPath);
      if (marker) {
        if (marker.status === "FAILED") {
          throw new Error(marker.errorCode ?? "PRODUCTION_STATE_MIGRATION_FAILED");
        }
        return;
      }
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > 30_000) await fs.unlink(lockPath);
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== "ENOENT") throw statError;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  if (!ownsLock) throw new Error("PRODUCTION_STATE_MIGRATION_BUSY");

  const importedFiles: string[] = [];
  let quarantinedLegacyControls = 0;
  try {
    const migrations = [
      {
        name: CONFIG_FILE,
        schema: productionConfigSchema,
        sanitize: (value: ProductionConfig) => value,
      },
      {
        name: STATE_FILE,
        schema: productionStateSchema,
        sanitize: sanitizeState,
      },
      {
        name: OBJECTIVE_PREFERENCES_FILE,
        schema: objectivePreferencesSchema,
        sanitize: (value: ObjectiveDevelopmentPreferences) => value,
      },
    ] as const;
    for (const migration of migrations) {
      const legacyPath = path.join(legacyDirectory(root), migration.name);
      try {
        const parsed = migration.schema.parse(await readJsonWithRetry(legacyPath));
        const sanitized = migration.sanitize(parsed as never);
        await writeJsonIfMissing(path.join(targetDirectory, migration.name), sanitized);
        importedFiles.push(migration.name);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw new Error(`INVALID_LEGACY_${migration.name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`);
      }
    }
    quarantinedLegacyControls = await countLegacyControls(root);
    await writeJson(markerPath, {
      version: 1,
      status: "SUCCEEDED",
      migratedAt: new Date().toISOString(),
      importedFiles,
      quarantinedLegacyControls,
      errorCode: null,
    });
  } catch (error) {
    const errorCode =
      error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "PRODUCTION_STATE_MIGRATION_FAILED";
    await writeJson(markerPath, {
      version: 1,
      status: "FAILED",
      migratedAt: new Date().toISOString(),
      importedFiles,
      quarantinedLegacyControls,
      errorCode,
    });
    throw new Error(errorCode);
  } finally {
    await fs.rm(lockPath, { force: true });
  }
}

export async function readProductionConfig(
  root = process.cwd(),
): Promise<ProductionConfig> {
  await ensureLegacyMigration(root);
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
  await ensureLegacyMigration(root);
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
  await ensureLegacyMigration(root);
  const filePath = path.join(directory(root), STATE_FILE);
  try {
    return sanitizeState(
      productionStateSchema.parse(await readJsonWithRetry(filePath)),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("INVALID_PRODUCTION_STATE");
    return emptyState();
  }
}

export async function writeProductionState(
  state: ProductionStateInput,
  root = process.cwd(),
): Promise<void> {
  await ensureLegacyMigration(root);
  const parsed = sanitizeState(productionStateSchema.parse({
    ...state,
    updatedAt: new Date().toISOString(),
  }));
  await writeJson(path.join(directory(root), STATE_FILE), parsed);
}

export function productionStateDirectory(root = process.cwd()): string {
  const resolved = directory(root);
  assertExternalDirectory(root, resolved);
  return resolved;
}

export async function enqueueProductionControl(
  type: ProductionControlCommand["type"],
  executionId: string,
  root = process.cwd(),
  details: {
    phaseNumber?: number;
    feedback?: string;
    improvedWithAi?: boolean;
    requestId?: string;
    content?: string;
    agentId?: string;
    author?: string;
    acceptedPhaseStatus?: ProductionControlCommand["acceptedPhaseStatus"];
  } = {},
): Promise<ProductionControlCommand> {
  await ensureLegacyMigration(root);
  const command = sanitizeControlCommand(productionControlCommandSchema.parse({
    id: randomUUID(),
    type,
    executionId,
    phaseNumber: details.phaseNumber ?? null,
    feedback: details.feedback ?? null,
    improvedWithAi: details.improvedWithAi ?? false,
    requestId: details.requestId ?? null,
    content: details.content ?? null,
    agentId: details.agentId ?? null,
    author: details.author ?? "Administrador",
    acceptedPhaseStatus: details.acceptedPhaseStatus ?? null,
    createdAt: new Date().toISOString(),
  }));
  await writeJson(
    path.join(directory(root), COMMAND_DIRECTORY, `${command.id}.json`),
    command,
  );
  return command;
}

export async function readProductionControls(
  root = process.cwd(),
): Promise<Array<{ command: ProductionControlCommand; filePath: string }>> {
  await ensureLegacyMigration(root);
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
        command: sanitizeControlCommand(
          productionControlCommandSchema.parse(await readJsonWithRetry(filePath)),
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
