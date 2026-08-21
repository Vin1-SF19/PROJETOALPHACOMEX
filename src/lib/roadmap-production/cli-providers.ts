import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { ProductionProvider } from "@/lib/roadmap-production/contracts";

const execFileAsync = promisify(execFile);
const CLI_TIMEOUT_MS = 30 * 60_000;
const MAX_CLI_OUTPUT_BYTES = 8 * 1024 * 1024;

type CliProvider = Extract<ProductionProvider, "codex" | "claude">;

export interface CliDiagnostic {
  provider: CliProvider;
  available: boolean;
  ready: boolean;
  detail: string;
  models: string[];
}

export interface CliAgentExecution {
  content: string;
  toolSteps: number;
  changedFiles: string[];
  errorCode?: string;
}

interface ResolvedCli {
  executable: string;
  version: string;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  toolSteps: number;
}

interface WorkspaceSnapshot {
  head: string;
  files: Map<string, string>;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function versionedExecutables(
  directory: string,
  resolveExecutable: (entry: string) => string,
): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const executable = resolveExecutable(entry.name);
          try {
            const stat = await fs.stat(executable);
            return stat.isFile()
              ? { executable, modifiedAt: stat.mtimeMs }
              : null;
          } catch {
            return null;
          }
        }),
    );
    return candidates
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => right.modifiedAt - left.modifiedAt)
      .map((item) => item.executable);
  } catch {
    return [];
  }
}

async function pathExecutables(command: string): Promise<string[]> {
  if (process.platform !== "win32") return [command];
  try {
    const result = await execFileAsync("where.exe", [command], {
      timeout: 5_000,
      windowsHide: true,
    });
    return String(result.stdout)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => /\.exe$/i.test(item));
  } catch {
    return [];
  }
}

async function cliCandidates(provider: CliProvider): Promise<string[]> {
  const home = os.homedir();
  const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const localAppData =
    process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const explicit =
    provider === "codex"
      ? process.env.ROADMAP_CODEX_CLI_PATH?.trim()
      : process.env.ROADMAP_CLAUDE_CLI_PATH?.trim();
  const pathMatches = await pathExecutables(provider);

  if (provider === "codex") {
    const desktop = await versionedExecutables(
      path.join(localAppData, "OpenAI", "Codex", "bin"),
      (entry) =>
        path.join(localAppData, "OpenAI", "Codex", "bin", entry, "codex.exe"),
    );
    const cursor = await versionedExecutables(
      path.join(home, ".cursor", "extensions"),
      (entry) =>
        entry.startsWith("openai.chatgpt-")
          ? path.join(
              home,
              ".cursor",
              "extensions",
              entry,
              "bin",
              "windows-x86_64",
              "codex.exe",
            )
          : path.join(home, ".cursor", "extensions", entry, "__missing__"),
    );
    return unique([explicit ?? "", ...desktop, ...cursor, ...pathMatches]);
  }

  const native = await versionedExecutables(
    path.join(appData, "Claude", "claude-code"),
    (entry) => path.join(appData, "Claude", "claude-code", entry, "claude.exe"),
  );
  const cursor = await versionedExecutables(
    path.join(home, ".cursor", "extensions"),
    (entry) =>
      entry.startsWith("anthropic.claude-code-")
        ? path.join(
            home,
            ".cursor",
            "extensions",
            entry,
            "resources",
            "native-binary",
            "claude.exe",
          )
        : path.join(home, ".cursor", "extensions", entry, "__missing__"),
  );
  const npmNative = path.join(
    appData,
    "npm",
    "node_modules",
    "@anthropic-ai",
    "claude-code",
    "node_modules",
    "@anthropic-ai",
    process.arch === "arm64"
      ? "claude-code-win32-arm64"
      : "claude-code-win32-x64",
    "claude.exe",
  );
  return unique([
    explicit ?? "",
    ...native,
    ...cursor,
    npmNative,
    ...pathMatches,
  ]);
}

async function resolveCli(provider: CliProvider): Promise<ResolvedCli | null> {
  for (const executable of await cliCandidates(provider)) {
    if (path.isAbsolute(executable) && !(await isFile(executable))) continue;
    try {
      const result = await execFileAsync(executable, ["--version"], {
        timeout: 10_000,
        windowsHide: true,
      });
      const version = `${result.stdout}${result.stderr}`.trim().slice(0, 120);
      if (
        (provider === "codex" && /codex/i.test(version)) ||
        (provider === "claude" && /claude|\d+\.\d+/i.test(version))
      ) {
        return { executable, version };
      }
    } catch {
      // Um launcher quebrado não impede a descoberta do próximo binário nativo.
    }
  }
  return null;
}

async function isAuthenticated(
  provider: CliProvider,
  executable: string,
): Promise<boolean> {
  try {
    const args =
      provider === "codex" ? ["login", "status"] : ["auth", "status"];
    const result = await execFileAsync(executable, args, {
      timeout: 15_000,
      windowsHide: true,
    });
    const output = `${result.stdout}${result.stderr}`.trim();
    if (provider === "codex") return /logged in/i.test(output);
    return (JSON.parse(output) as { loggedIn?: boolean }).loggedIn === true;
  } catch {
    return false;
  }
}

export async function diagnoseCliProviders(): Promise<CliDiagnostic[]> {
  return await Promise.all(
    (["codex", "claude"] as const).map(async (provider) => {
      const resolved = await resolveCli(provider);
      if (!resolved) {
        return {
          provider,
          available: false,
          ready: false,
          detail:
            provider === "codex"
              ? "CLI não executável; verifique a instalação do Codex"
              : "CLI não executável; o launcher global pode estar quebrado",
          models: [],
        };
      }
      const authenticated = await isAuthenticated(
        provider,
        resolved.executable,
      );
      return {
        provider,
        available: true,
        ready: authenticated,
        detail: authenticated
          ? `Conectado · ${resolved.version}`
          : "CLI detectada; faça login antes de usar",
        models: authenticated ? ["default"] : [],
      };
    }),
  );
}

async function fileDigest(filePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function workspaceSnapshot(root: string): Promise<WorkspaceSnapshot> {
  const [headResult, filesResult] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      timeout: 10_000,
      windowsHide: true,
    }),
    execFileAsync(
      "git",
      ["ls-files", "-m", "-o", "-d", "--exclude-standard", "-z"],
      {
        cwd: root,
        timeout: 20_000,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        encoding: "buffer",
      },
    ),
  ]);
  const relativePaths = Buffer.from(filesResult.stdout)
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const files = new Map<string, string>();
  await Promise.all(
    relativePaths.map(async (relativePath) => {
      const absolutePath = path.resolve(root, relativePath);
      const insideRoot =
        absolutePath === root || absolutePath.startsWith(`${root}${path.sep}`);
      if (!insideRoot) return;
      try {
        files.set(
          relativePath.replaceAll("\\", "/"),
          await fileDigest(absolutePath),
        );
      } catch {
        files.set(relativePath.replaceAll("\\", "/"), "__DELETED__");
      }
    }),
  );
  return { head: String(headResult.stdout).trim(), files };
}

function changedPaths(
  before: WorkspaceSnapshot,
  after: WorkspaceSnapshot,
): string[] {
  const paths = new Set([...before.files.keys(), ...after.files.keys()]);
  return [...paths]
    .filter((item) => before.files.get(item) !== after.files.get(item))
    .sort()
    .slice(0, 100);
}

function safeActivity(
  provider: CliProvider,
  line: string,
): { message?: string; final?: string; toolStep?: boolean } {
  try {
    const event = JSON.parse(line) as Record<string, unknown>;
    if (provider === "codex") {
      const item = event.item as
        { type?: string; text?: string; name?: string } | undefined;
      if (event.type === "item.completed" && item?.type === "agent_message")
        return { final: item.text ?? "" };
      if (item?.type === "command_execution")
        return { message: "Executando comando de validação", toolStep: true };
      if (item?.type === "file_change")
        return { message: "Executando alteração de arquivo", toolStep: true };
      if (item?.type === "mcp_tool_call")
        return { message: "Executando integração MCP", toolStep: true };
      return {};
    }
    if (event.type === "result")
      return { final: typeof event.result === "string" ? event.result : "" };
    if (event.type === "assistant") {
      const message = event.message as
        { content?: Array<{ type?: string; name?: string }> } | undefined;
      const tool = message?.content?.find((item) => item.type === "tool_use");
      if (tool)
        return {
          message: `Executando ${String(tool.name ?? "tool").slice(0, 80)}`,
          toolStep: true,
        };
    }
  } catch {
    // Logs não estruturados são ignorados para não expor comandos ou segredos.
  }
  return {};
}

async function runProcess(
  provider: CliProvider,
  executable: string,
  args: string[],
  prompt: string,
  root: string,
  onActivity: (message: string) => Promise<void> | void,
): Promise<ProcessResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: root,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    let pending = "";
    let outputBytes = 0;
    let toolSteps = 0;
    let timedOut = false;
    let activityQueue = Promise.resolve();
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, CLI_TIMEOUT_MS);
    const consumeLine = (line: string) => {
      const activity = safeActivity(provider, line);
      if (activity.toolStep) toolSteps += 1;
      if (activity.message) {
        activityQueue = activityQueue
          .then(() => onActivity(activity.message!))
          .then(() => undefined)
          .catch(() => undefined);
      }
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes <= MAX_CLI_OUTPUT_BYTES) stdout += chunk;
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) consumeLine(line);
    });
    child.stderr.on("data", (chunk: string) => {
      if (Buffer.byteLength(stderr) < 32_000) stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", async (code) => {
      clearTimeout(timer);
      if (pending) consumeLine(pending);
      await activityQueue;
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        timedOut,
        toolSteps,
      });
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(prompt);
  });
}

function extractFinal(provider: CliProvider, stdout: string): string {
  let final = "";
  for (const line of stdout.split(/\r?\n/)) {
    const parsed = safeActivity(provider, line);
    if (parsed.final) final = parsed.final;
  }
  return final.trim();
}

function structuredProviderError(
  stdout: string,
  stderr: string,
): string | null {
  const combined = `${stdout}\n${stderr}`;
  const structuredFailure =
    /"is_error"\s*:\s*true/i.test(stdout) ||
    /"subtype"\s*:\s*"(?:error|failure|rate_limit_error)"/i.test(stdout);
  const quotaFailure =
    /credit(?:s)?|quota|usage\s+limit|billing|limit\s+(?:reached|exceeded)|resets?\s+(?:at|in)/i.test(
      combined,
    );
  if (quotaFailure && (structuredFailure || Boolean(stderr.trim())))
    return "PROVIDER_QUOTA_EXHAUSTED";
  if (
    /rate.?limit|too many requests|429/i.test(combined) &&
    (structuredFailure || Boolean(stderr.trim()))
  )
    return "PROVIDER_RATE_LIMITED";
  return null;
}

function cliArgs(
  provider: CliProvider,
  root: string,
  model: string,
  allowWrite: boolean,
): string[] {
  if (provider === "codex") {
    return [
      "exec",
      "--ephemeral",
      "--sandbox",
      allowWrite ? "workspace-write" : "read-only",
      "--cd",
      root,
      "--color",
      "never",
      "--json",
      ...(model !== "default" ? ["--model", model] : []),
      "-",
    ];
  }
  const tools = allowWrite
    ? "Read,Glob,Grep,Edit,Write,Bash"
    : "Read,Glob,Grep";
  const allowedTools = allowWrite
    ? "Read,Glob,Grep,Edit,Write,Bash(git status *),Bash(git diff *),Bash(npm run typecheck *),Bash(npx tsc *),Bash(npx vitest *),Bash(npx eslint *)"
    : "Read,Glob,Grep";
  return [
    "-p",
    "--safe-mode",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--output-format",
    "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    "--tools",
    tools,
    "--allowedTools",
    allowedTools,
    ...(model !== "default" ? ["--model", model] : []),
  ];
}

export async function runCliProductionAgent(
  provider: CliProvider,
  model: string,
  prompt: string,
  root: string,
  allowWrite: boolean,
  onActivity: (message: string) => Promise<void> | void,
): Promise<CliAgentExecution> {
  const resolved = await resolveCli(provider);
  if (!resolved)
    return {
      content: "CLI indisponível.",
      toolSteps: 0,
      changedFiles: [],
      errorCode: "CLI_NOT_FOUND",
    };
  if (!(await isAuthenticated(provider, resolved.executable)))
    return {
      content: "A CLI precisa estar autenticada.",
      toolSteps: 0,
      changedFiles: [],
      errorCode: "PROVIDER_AUTH_FAILED",
    };

  await onActivity(
    `Executando ${provider === "codex" ? "Codex CLI" : "Claude Code"}`,
  );
  const before = await workspaceSnapshot(root);
  const processResult = await runProcess(
    provider,
    resolved.executable,
    cliArgs(provider, root, model, allowWrite),
    prompt,
    root,
    onActivity,
  );
  const after = await workspaceSnapshot(root);
  const files = changedPaths(before, after);
  for (const file of files) await onActivity(`Alterou ${file}`);

  if (before.head !== after.head)
    return {
      content: "A CLI alterou o HEAD do repositório, operação proibida.",
      toolSteps: processResult.toolSteps,
      changedFiles: files,
      errorCode: "PROHIBITED_GIT_MUTATION",
    };
  if (processResult.timedOut)
    return {
      content: "A CLI excedeu o tempo limite.",
      toolSteps: processResult.toolSteps,
      changedFiles: files,
      errorCode: "CLI_TIMEOUT",
    };
  const providerError = structuredProviderError(
    processResult.stdout,
    processResult.stderr,
  );
  if (providerError)
    return {
      content:
        providerError === "PROVIDER_QUOTA_EXHAUSTED"
          ? "O provedor atingiu o limite de créditos ou uso."
          : "O provedor aplicou um limite temporário de requisições.",
      toolSteps: processResult.toolSteps,
      changedFiles: files,
      errorCode: providerError,
    };
  if (processResult.exitCode !== 0) {
    const authenticationFailure = /auth|login|unauthorized|401|403/i.test(
      processResult.stderr,
    );
    // As últimas linhas de stderr costumam trazer a causa real (stack trace ou mensagem do
    // provedor) — sem isso, todo erro de CLI virava o mesmo texto genérico "terminou com erro".
    const detail = (processResult.stderr || processResult.stdout).trim().slice(-500);
    return {
      content: authenticationFailure
        ? "A autenticação da CLI falhou."
        : `A CLI terminou com erro (código de saída ${processResult.exitCode}).${detail ? `\n${detail}` : ""}`,
      toolSteps: processResult.toolSteps,
      changedFiles: files,
      errorCode: authenticationFailure
        ? "PROVIDER_AUTH_FAILED"
        : "CLI_EXECUTION_FAILED",
    };
  }
  const content = extractFinal(provider, processResult.stdout);
  return {
    content,
    toolSteps: processResult.toolSteps,
    changedFiles: files,
    errorCode: content ? undefined : "INVALID_PROVIDER_RESPONSE",
  };
}

export const cliProviderInternals = {
  cliArgs,
  extractFinal,
  structuredProviderError,
};
