import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_TOOL_OUTPUT = 30_000;
const MAX_READ_CHARS = 60_000;
const MAX_WRITE_CHARS = 200_000;
const PROTECTED_SEGMENTS = new Set([
  ".git", ".next", "node_modules", ".roadmap-production", ".roadmap-worker",
  "database-backups", "prompt-phases",
]);
const WRITE_PROTECTED_SEGMENTS = new Set([".claude", ".agents", ".aiox-core"]);
const WRITABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".css", ".scss",
  ".html", ".yml", ".yaml", ".sql", ".prisma", ".txt", ".svg",
]);
const MEMORY_AGENTS = new Set(["scribe", "kowalski"]);

export interface ProductionToolContext {
  root: string;
  agentId: string;
  allowWrite: boolean;
  onActivity?: (message: string) => Promise<void> | void;
}

export interface ProductionToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export const PRODUCTION_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Lista arquivos do projeto por caminho relativo. Diretórios protegidos e segredos são omitidos.",
      parameters: { type: "object", properties: { directory: { type: "string" }, limit: { type: "integer" } }, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Lê um arquivo de texto do projeto por caminho relativo, opcionalmente por faixa de linhas.",
      parameters: { type: "object", properties: { path: { type: "string" }, startLine: { type: "integer" }, endLine: { type: "integer" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Busca texto ou regex no projeto com ripgrep, sem acessar diretórios protegidos.",
      parameters: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" }, maxResults: { type: "integer" } }, required: ["pattern"] },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_in_file",
      description: "Substitui exatamente uma ocorrência em arquivo de texto já existente. Leia o arquivo antes.",
      parameters: { type: "object", properties: { path: { type: "string" }, oldText: { type: "string" }, newText: { type: "string" } }, required: ["path", "oldText", "newText"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_file",
      description: "Cria um novo arquivo de texto dentro do projeto sem sobrescrever arquivo existente.",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    },
  },
  {
    type: "function",
    function: {
      name: "run_check",
      description: "Executa somente um gate allowlisted: git_status, git_diff, eslint, typecheck, roadmap_tests ou tests.",
      parameters: {
        type: "object",
        properties: {
          check: { type: "string", enum: ["git_status", "git_diff", "eslint", "typecheck", "roadmap_tests", "tests"] },
          paths: { type: "array", items: { type: "string" }, maxItems: 20 },
        },
        required: ["check"],
      },
    },
  },
] as const;

function safeRelativePath(value: unknown): string {
  const raw = String(value ?? ".").trim().replaceAll("\\", "/");
  if (!raw || raw.startsWith("/") || /^[a-z]:/i.test(raw) || raw.includes("\0")) throw new Error("UNSAFE_PATH");
  const normalized = path.posix.normalize(raw);
  if (normalized === ".." || normalized.startsWith("../")) throw new Error("UNSAFE_PATH");
  return normalized === "." ? "." : normalized.replace(/^\.\//, "");
}

function hasProtectedSegment(relative: string): boolean {
  const segments = relative.toLocaleLowerCase("en-US").split("/");
  if (segments.some((segment) => PROTECTED_SEGMENTS.has(segment))) return true;
  const base = segments.at(-1) ?? "";
  return base === ".env" || base.startsWith(".env.") || base.endsWith(".db") || base.endsWith(".sqlite") || base.endsWith(".sqlite3");
}

function resolveInsideProject(root: string, relative: string): string {
  const full = path.resolve(root, relative);
  const normalizedRoot = path.resolve(root);
  if (full !== normalizedRoot && !full.startsWith(`${normalizedRoot}${path.sep}`)) throw new Error("UNSAFE_PATH");
  return full;
}

function assertReadable(relative: string): void {
  if (hasProtectedSegment(relative)) throw new Error("PROTECTED_PATH");
}

function assertWritable(relative: string, context: ProductionToolContext): void {
  if (!context.allowWrite) throw new Error("AGENT_READ_ONLY");
  const normalized = relative.toLocaleLowerCase("en-US");
  const memoryWrite = MEMORY_AGENTS.has(context.agentId) && normalized.startsWith(".bibble/memory/");
  if (hasProtectedSegment(relative) && !memoryWrite) throw new Error("PROTECTED_PATH");
  if (normalized.split("/").some((segment) => WRITE_PROTECTED_SEGMENTS.has(segment))) throw new Error("PROTECTED_PATH");
  if (normalized.startsWith(".bibble/") && !memoryWrite) throw new Error("PROTECTED_PATH");
  if (normalized === "prisma/schema.prisma" || normalized.startsWith("prisma/migrations/")) throw new Error("DATABASE_CHANGE_REQUIRES_APPROVAL");
  if (!WRITABLE_EXTENSIONS.has(path.extname(relative).toLocaleLowerCase("en-US"))) throw new Error("UNSUPPORTED_FILE_TYPE");
}

async function assertRealPathInsideProject(root: string, full: string, creating = false): Promise<void> {
  const normalizedRoot = await fs.realpath(path.resolve(root));
  let candidate = creating ? path.dirname(full) : full;
  let real: string;
  while (true) {
    try {
      real = await fs.realpath(candidate);
      break;
    } catch (error) {
      if (!creating || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(candidate);
      if (parent === candidate) throw new Error("UNSAFE_SYMLINK");
      candidate = parent;
    }
  }
  if (real !== normalizedRoot && !real.startsWith(`${normalizedRoot}${path.sep}`)) throw new Error("UNSAFE_SYMLINK");
}

function truncate(value: string): string {
  return value.length > MAX_TOOL_OUTPUT ? `${value.slice(0, MAX_TOOL_OUTPUT)}\n...[truncado]` : value;
}

async function listFiles(context: ProductionToolContext, args: Record<string, unknown>): Promise<string> {
  const relative = safeRelativePath(args.directory ?? ".");
  assertReadable(relative);
  const start = resolveInsideProject(context.root, relative);
  await assertRealPathInsideProject(context.root, start);
  const limit = Math.max(1, Math.min(Number(args.limit ?? 250), 500));
  const result: string[] = [];
  const queue: Array<{ absolute: string; relative: string }> = [{ absolute: start, relative }];
  while (queue.length && result.length < limit) {
    const current = queue.shift()!;
    const entries = await fs.readdir(current.absolute, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const childRelative = current.relative === "." ? entry.name : `${current.relative}/${entry.name}`;
      if (hasProtectedSegment(childRelative)) continue;
      if (entry.isDirectory()) queue.push({ absolute: path.join(current.absolute, entry.name), relative: childRelative });
      else if (entry.isFile()) result.push(childRelative);
      if (result.length >= limit) break;
    }
  }
  return JSON.stringify({ files: result, truncated: queue.length > 0 || result.length >= limit });
}

async function readFile(context: ProductionToolContext, args: Record<string, unknown>): Promise<string> {
  const relative = safeRelativePath(args.path);
  assertReadable(relative);
  const full = resolveInsideProject(context.root, relative);
  await assertRealPathInsideProject(context.root, full);
  const content = await fs.readFile(full, "utf8");
  const lines = content.split(/\r?\n/);
  const start = Math.max(1, Math.min(Number(args.startLine ?? 1), lines.length || 1));
  const end = Math.max(start, Math.min(Number(args.endLine ?? lines.length), lines.length));
  const selected = lines.slice(start - 1, end).join("\n");
  return truncate(JSON.stringify({ path: relative, startLine: start, endLine: end, content: selected.slice(0, MAX_READ_CHARS) }));
}

async function searchCode(context: ProductionToolContext, args: Record<string, unknown>): Promise<string> {
  const pattern = String(args.pattern ?? "").trim();
  if (!pattern || pattern.length > 500) throw new Error("INVALID_SEARCH_PATTERN");
  const relative = safeRelativePath(args.path ?? ".");
  assertReadable(relative);
  const maxResults = Math.max(1, Math.min(Number(args.maxResults ?? 100), 300));
  const rgArgs = ["--line-number", "--color", "never", "--max-count", String(maxResults),
    "--glob", "!.git/**", "--glob", "!.next/**", "--glob", "!node_modules/**",
    "--glob", "!.roadmap-production/**", "--glob", "!database-backups/**", pattern, relative];
  try {
    const result = await execFileAsync("rg", rgArgs, { cwd: context.root, timeout: 30_000, maxBuffer: 2_000_000, windowsHide: true });
    return truncate(result.stdout || "Nenhuma ocorrência.");
  } catch (error) {
    const failure = error as { code?: number; stdout?: string };
    if (failure.code === 1) return "Nenhuma ocorrência.";
    try {
      const literalArgs = [...rgArgs];
      literalArgs.splice(literalArgs.length - 2, 0, "--fixed-strings");
      const literal = await execFileAsync("rg", literalArgs, { cwd: context.root, timeout: 30_000, maxBuffer: 2_000_000, windowsHide: true });
      return truncate(literal.stdout || "Nenhuma ocorrência.");
    } catch (literalError) {
      if ((literalError as { code?: number }).code === 1) return "Nenhuma ocorrência.";
      throw new Error("SEARCH_FAILED");
    }
  }
}

async function replaceInFile(context: ProductionToolContext, args: Record<string, unknown>): Promise<string> {
  const relative = safeRelativePath(args.path);
  assertWritable(relative, context);
  const oldText = String(args.oldText ?? "");
  const newText = String(args.newText ?? "");
  if (!oldText || oldText.length > MAX_WRITE_CHARS || newText.length > MAX_WRITE_CHARS) throw new Error("INVALID_REPLACEMENT");
  const full = resolveInsideProject(context.root, relative);
  await assertRealPathInsideProject(context.root, full);
  const current = await fs.readFile(full, "utf8");
  const first = current.indexOf(oldText);
  if (first < 0) throw new Error("OLD_TEXT_NOT_FOUND");
  if (current.indexOf(oldText, first + oldText.length) >= 0) throw new Error("OLD_TEXT_NOT_UNIQUE");
  await fs.writeFile(full, current.slice(0, first) + newText + current.slice(first + oldText.length), "utf8");
  await context.onActivity?.(`Alterou ${relative}`);
  return JSON.stringify({ success: true, path: relative });
}

async function createFile(context: ProductionToolContext, args: Record<string, unknown>): Promise<string> {
  const relative = safeRelativePath(args.path);
  assertWritable(relative, context);
  const content = String(args.content ?? "");
  if (content.length > MAX_WRITE_CHARS) throw new Error("CONTENT_TOO_LARGE");
  const full = resolveInsideProject(context.root, relative);
  await assertRealPathInsideProject(context.root, full, true);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, { encoding: "utf8", flag: "wx" });
  await context.onActivity?.(`Criou ${relative}`);
  return JSON.stringify({ success: true, path: relative });
}

function validateCheckPaths(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 20).map(safeRelativePath).filter((relative) => {
    assertReadable(relative);
    return true;
  });
}

async function runCheck(context: ProductionToolContext, args: Record<string, unknown>): Promise<string> {
  const check = String(args.check ?? "");
  const paths = validateCheckPaths(args.paths);
  let executable: string;
  let commandArgs: string[];
  if (check === "git_status") {
    executable = "git"; commandArgs = ["status", "--short"];
  } else if (check === "git_diff") {
    executable = "git"; commandArgs = ["diff", "--", ...(paths.length ? paths : ["."])];
  } else if (check === "eslint") {
    executable = "npx.cmd"; commandArgs = ["eslint", ...(paths.length ? paths : ["src"] )];
  } else if (check === "typecheck") {
    executable = "npm.cmd"; commandArgs = ["run", "typecheck"];
  } else if (check === "roadmap_tests") {
    executable = "npx.cmd"; commandArgs = ["vitest", "run", "tests/roadmap-alpha"];
  } else if (check === "tests") {
    if (!paths.length || paths.some((relative) => !relative.startsWith("tests/"))) throw new Error("TEST_PATH_REQUIRED");
    executable = "npx.cmd"; commandArgs = ["vitest", "run", ...paths];
  } else {
    throw new Error("CHECK_NOT_ALLOWED");
  }
  await context.onActivity?.(`Executando gate ${check}`);
  try {
    const result = await execFileAsync(executable, commandArgs, { cwd: context.root, timeout: 10 * 60_000, maxBuffer: 4_000_000, windowsHide: true });
    return truncate(JSON.stringify({ check, exitCode: 0, output: `${result.stdout}${result.stderr}` }));
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return truncate(JSON.stringify({ check, exitCode: typeof failure.code === "number" ? failure.code : 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` }));
  }
}

export async function executeProductionTool(call: ProductionToolCall, context: ProductionToolContext): Promise<string> {
  try {
    if (call.name === "list_files") return await listFiles(context, call.arguments);
    if (call.name === "read_file") return await readFile(context, call.arguments);
    if (call.name === "search_code") return await searchCode(context, call.arguments);
    if (call.name === "replace_in_file") return await replaceInFile(context, call.arguments);
    if (call.name === "create_file") return await createFile(context, call.arguments);
    if (call.name === "run_check") return await runCheck(context, call.arguments);
    throw new Error("UNKNOWN_TOOL");
  } catch (error) {
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "TOOL_FAILED";
    await context.onActivity?.(`Tool ${call.name}: ${code}`);
    return JSON.stringify({ success: false, errorCode: code });
  }
}
