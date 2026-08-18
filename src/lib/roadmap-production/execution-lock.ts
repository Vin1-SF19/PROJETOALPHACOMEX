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
 * Exclusive, non-blocking lease shared by the UI process and local workers.
 * The file is created atomically and is only reclaimed when its owner PID no
 * longer exists, preventing two objectives from being developed concurrently.
 */
export async function acquireProductionExecutionLease(
  root = process.cwd(),
): Promise<ProductionExecutionLease | null> {
  const stateDirectory = productionStateDirectory(root);
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
