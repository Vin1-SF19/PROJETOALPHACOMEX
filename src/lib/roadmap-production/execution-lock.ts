import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { productionStateDirectory } from "@/lib/roadmap-production/storage";

const LOCK_FILE = "execution.lock";

interface LockOwner {
  token: string;
  pid: number;
  createdAt: string;
}

export interface ProductionExecutionLease {
  release: () => Promise<void>;
}

function isAlreadyExists(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "EEXIST";
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function readOwner(lockPath: string): Promise<LockOwner | null> {
  try {
    const parsed = JSON.parse(
      await fs.readFile(lockPath, "utf8"),
    ) as Partial<LockOwner>;
    if (
      typeof parsed.token !== "string" ||
      typeof parsed.pid !== "number" ||
      typeof parsed.createdAt !== "string"
    ) {
      return null;
    }
    return parsed as LockOwner;
  } catch (error) {
    if (isMissing(error)) return null;
    return null;
  }
}

/**
 * Diretório fixo do lock, sempre a raiz real do PainelAlpha — NUNCA o `root`
 * recebido. Isto é intencional: o lock é GLOBAL ao sistema inteiro (um único
 * modelo de IA trabalhando por vez, custe de qual projeto for), não por
 * workspace. Todo processo worker (interno ou de projeto externo) roda a
 * partir desta mesma pasta (`Set-Location` nos scripts .ps1), então este
 * caminho é sempre alcançável por qualquer um deles.
 */
const GLOBAL_LOCK_ROOT = process.cwd();

/**
 * Exclusive, non-blocking lease compartilhado por TODOS os workers do
 * sistema (PainelAlpha e qualquer projeto externo) — nunca por `root`
 * individual. Garante que só uma fase de desenvolvimento (uma chamada ao
 * modelo) roda por vez no sistema inteiro, mesmo que existam vários
 * workers ativos simultaneamente em projetos diferentes; evita sobrecarga
 * dos provedores de IA. O parâmetro `root` é aceito só por compatibilidade
 * de assinatura com quem chama — NUNCA usado para localizar o lock.
 */
export async function acquireProductionExecutionLease(
  root = process.cwd(),
): Promise<ProductionExecutionLease | null> {
  void root;
  const stateDirectory = productionStateDirectory(GLOBAL_LOCK_ROOT);
  const lockPath = path.resolve(stateDirectory, LOCK_FILE);
  if (path.dirname(lockPath) !== path.resolve(stateDirectory)) {
    throw new Error("INVALID_PRODUCTION_LOCK_PATH");
  }
  await fs.mkdir(stateDirectory, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const owner: LockOwner = {
      token: randomUUID(),
      pid: process.pid,
      createdAt: new Date().toISOString(),
    };
    try {
      await fs.writeFile(lockPath, `${JSON.stringify(owner)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      return {
        release: async () => {
          const currentOwner = await readOwner(lockPath);
          if (currentOwner?.token !== owner.token) return;
          try {
            await fs.unlink(lockPath);
          } catch (error) {
            if (!isMissing(error)) throw error;
          }
        },
      };
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      const currentOwner = await readOwner(lockPath);
      if (currentOwner && processIsAlive(currentOwner.pid)) return null;
      if (!currentOwner) {
        try {
          const lockStat = await fs.stat(lockPath);
          if (Date.now() - lockStat.mtimeMs < 30_000) return null;
        } catch (statError) {
          if (!isMissing(statError)) return null;
        }
      }
      try {
        await fs.unlink(lockPath);
      } catch (unlinkError) {
        if (!isMissing(unlinkError)) return null;
      }
    }
  }
  return null;
}
