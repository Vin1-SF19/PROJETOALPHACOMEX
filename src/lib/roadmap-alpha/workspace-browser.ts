import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export interface DirectoryEntry {
  name: string;
  path: string;
}

export interface DirectoryListing {
  path: string;
  parentPath: string | null;
  directories: DirectoryEntry[];
}

const pathSchema = z.string().trim().min(1).max(500);

/** Raízes de navegação permitidas quando nenhum path é informado. */
function windowsDriveRoots(): string[] {
  const letters = "CDEFGH".split("");
  return letters.map((letter) => `${letter}:\\`);
}

async function isAccessibleDirectory(target: string): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Lista subdiretórios de um path absoluto para o picker "Novo projeto".
 * Nunca aceita path relativo, nunca segue links simbólicos fora do
 * diretório listado, e nunca expõe arquivos — só diretórios navegáveis.
 * Path inacessível/inexistente cai para as raízes de disco conhecidas.
 */
export async function listWorkspaceDirectories(
  requestedPath?: string,
): Promise<DirectoryListing> {
  const parsed = requestedPath
    ? pathSchema.safeParse(requestedPath)
    : { success: false as const };
  const isAbsolute = parsed.success && path.win32.isAbsolute(parsed.data);

  if (!isAbsolute || !(await isAccessibleDirectory(parsed.data))) {
    const roots = (
      await Promise.all(
        windowsDriveRoots().map(async (root) => ({
          root,
          ok: await isAccessibleDirectory(root),
        })),
      )
    )
      .filter((item) => item.ok)
      .map((item) => ({ name: item.root, path: item.root }));
    return { path: "", parentPath: null, directories: roots };
  }

  const current = path.win32.normalize(parsed.data);
  let names: string[];
  try {
    names = await fs.readdir(current);
  } catch {
    return { path: current, parentPath: null, directories: [] };
  }

  const entries = await Promise.all(
    names.slice(0, 500).map(async (name) => {
      const full = path.win32.join(current, name);
      const ok = await isAccessibleDirectory(full);
      return ok ? { name, path: full } : null;
    }),
  );

  const directories = entries
    .filter((entry): entry is DirectoryEntry => entry !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const parent = path.win32.dirname(current);
  const parentPath = parent === current ? null : parent;

  return { path: current, parentPath, directories };
}

/** Revalida no momento do uso — nunca confia em path salvo sem checar de novo. */
export async function assertWorkspaceRootPathUsable(
  rootPath: string,
): Promise<void> {
  const parsed = pathSchema.parse(rootPath);
  if (!path.win32.isAbsolute(parsed)) throw new Error("WORKSPACE_PATH_INVALID");
  if (!(await isAccessibleDirectory(parsed)))
    throw new Error("WORKSPACE_PATH_UNAVAILABLE");
}
