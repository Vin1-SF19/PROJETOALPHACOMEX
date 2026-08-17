import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { roadmapPhaseFilename, type RoadmapPhaseManifest } from "@/lib/roadmap-alpha/contracts";

export interface RoadmapProjectionInput {
  moduleKey: string;
  objectiveCode: string;
  version: number;
  manifest: RoadmapPhaseManifest;
}

function safeSegment(value: string): string {
  if (!/^[\p{L}\p{N}_-]+$/u.test(value) || value === "." || value === "..") throw new Error("UNSAFE_PROJECTION_PATH");
  return value;
}

function projectionFiles(input: RoadmapProjectionInput): Map<string, string> {
  const files = new Map<string, string>();
  input.manifest.phases.forEach((phase) => files.set(roadmapPhaseFilename(phase), `${phase.markdown.trim()}\n`));
  files.set("_status.md", [
    `# ${input.objectiveCode}`,
    "",
    `- Status: DOCUMENTED`,
    `- Versão: ${input.version}`,
    `- Módulo: ${input.moduleKey}`,
    `- Fases: ${input.manifest.phases.length}`,
    "",
    input.manifest.summary.trim(),
    "",
  ].join("\n"));
  return files;
}

async function directoryMatches(directory: string, expected: Map<string, string>): Promise<boolean> {
  try {
    const names = (await fs.readdir(directory)).sort();
    const expectedNames = Array.from(expected.keys()).sort();
    if (JSON.stringify(names) !== JSON.stringify(expectedNames)) return false;
    for (const [name, content] of expected) {
      if (await fs.readFile(path.join(directory, name), "utf8") !== content) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function publishRoadmapProjection(input: RoadmapProjectionInput, root = process.cwd()) {
  const namespaceRoot = path.resolve(root, "prompt-phases", "roadmap-alpha");
  const revision = `r${String(input.version).padStart(4, "0")}`;
  const destination = path.resolve(
    namespaceRoot,
    safeSegment(input.moduleKey),
    safeSegment(input.objectiveCode),
    revision,
  );
  if (!destination.startsWith(`${namespaceRoot}${path.sep}`)) throw new Error("UNSAFE_PROJECTION_PATH");

  const files = projectionFiles(input);
  if (await directoryMatches(destination, files)) {
    return { relativeDirectory: path.relative(root, destination).replaceAll(path.sep, "/"), files };
  }
  try {
    await fs.access(destination);
    throw new Error("PROJECTION_CONFLICT");
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECTION_CONFLICT") throw error;
  }

  const temporary = `${destination}.tmp-${randomUUID()}`;
  if (!temporary.startsWith(`${namespaceRoot}${path.sep}`)) throw new Error("UNSAFE_PROJECTION_PATH");
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.mkdir(temporary, { recursive: false });
  try {
    await Promise.all(Array.from(files, ([name, content]) => fs.writeFile(path.join(temporary, name), content, { encoding: "utf8", flag: "wx" })));
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    throw error;
  }
  return {
    relativeDirectory: path.relative(root, destination).replaceAll(path.sep, "/"),
    files,
  };
}

export function markdownSha256(markdown: string): string {
  return createHash("sha256").update(markdown).digest("hex");
}
