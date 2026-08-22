import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".turbo",
  ".vercel",
  "out",
  ".cache",
]);

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".svg",
  ".mp4", ".mov", ".avi", ".webm", ".mp3", ".wav", ".ogg",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".node",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".pdf", ".db", ".sqlite", ".sqlite3",
]);

const MAX_CONTEXT_CHARS = 100_000;

interface ScannedFile {
  relativePath: string;
  content: string;
}

async function collectFiles(
  root: string,
  currentDir: string,
  files: Array<{ relativePath: string; absolutePath: string }>,
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      await collectFiles(root, path.join(currentDir, entry.name), files);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (BINARY_EXTENSIONS.has(extension)) continue;
    const absolutePath = path.join(currentDir, entry.name);
    files.push({
      relativePath: path.relative(root, absolutePath).replaceAll(path.sep, "/"),
      absolutePath,
    });
  }
}

/**
 * Varredura real e sem restrição de conteúdo (decisão explícita do usuário,
 * ver .bibble/memory/decisions.md 2026-08-22 — Qwen roda localmente na rede
 * interna, sem vetor de vazamento externo). Não excluir .env/credenciais por
 * nome ou extensão: já foi perguntado e recusado duas vezes.
 *
 * Os únicos filtros aplicados são técnicos (ruído/binário/limite de payload
 * para a chamada de API), nunca de sensibilidade de conteúdo.
 */
export async function scanProjectContext(root: string): Promise<string> {
  const files: Array<{ relativePath: string; absolutePath: string }> = [];
  try {
    await collectFiles(root, root, files);
  } catch {
    return "[Não foi possível ler o diretório do projeto para gerar contexto.]";
  }

  const tree = files
    .map((file) => file.relativePath)
    .sort((a, b) => a.localeCompare(b))
    .join("\n");

  const sortedByDepthThenPath = [...files].sort((a, b) => {
    const depthDiff =
      a.relativePath.split("/").length - b.relativePath.split("/").length;
    return depthDiff !== 0 ? depthDiff : a.relativePath.localeCompare(b.relativePath);
  });

  const scannedFiles: ScannedFile[] = [];
  let accumulatedChars = tree.length;
  let truncated = false;

  for (const file of sortedByDepthThenPath) {
    if (accumulatedChars >= MAX_CONTEXT_CHARS) {
      truncated = true;
      break;
    }
    let content: string;
    try {
      content = await readFile(file.absolutePath, "utf-8");
    } catch {
      continue;
    }
    const remaining = MAX_CONTEXT_CHARS - accumulatedChars;
    const slice = content.length > remaining ? content.slice(0, remaining) : content;
    if (slice.length < content.length) truncated = true;
    scannedFiles.push({ relativePath: file.relativePath, content: slice });
    accumulatedChars += slice.length;
  }

  const filesBlock = scannedFiles
    .map((file) => `### ${file.relativePath}\n\`\`\`\n${file.content}\n\`\`\``)
    .join("\n\n");

  return [
    `## Estrutura de arquivos (${files.length} arquivos)`,
    tree,
    "",
    "## Conteúdo dos arquivos",
    filesBlock,
    truncated
      ? "\n[Contexto truncado por tamanho — nem todos os arquivos/conteúdos couberam no limite de payload.]"
      : "",
  ].join("\n");
}
