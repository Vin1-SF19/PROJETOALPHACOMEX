import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { acquireProductionExecutionLease } from "@/lib/roadmap-production/execution-lock";
import { productionStateDirectory } from "@/lib/roadmap-production/storage";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const value = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-lock-"));
  roots.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((value) => fs.rm(value, { recursive: true, force: true })),
  );
});

describe("lock global da Produção", () => {
  it("permite somente uma execução por vez e libera para a próxima", async () => {
    const project = await createRoot();
    const first = await acquireProductionExecutionLease(project);

    expect(first).not.toBeNull();
    expect(await acquireProductionExecutionLease(project)).toBeNull();

    await first?.release();
    const second = await acquireProductionExecutionLease(project);
    expect(second).not.toBeNull();
    await second?.release();
  });

  it("recupera um lock cujo processo proprietário não existe mais", async () => {
    const project = await createRoot();
    const stateDirectory = productionStateDirectory(project);
    await fs.mkdir(stateDirectory, { recursive: true });
    await fs.writeFile(
      path.join(stateDirectory, "execution.lock"),
      JSON.stringify({
        token: "stale",
        pid: 2_000_000_000,
        createdAt: "2000-01-01T00:00:00.000Z",
      }),
    );

    const lease = await acquireProductionExecutionLease(project);
    expect(lease).not.toBeNull();
    await lease?.release();
  });

  it("não remove um lock recém-criado enquanto o proprietário ainda o grava", async () => {
    const project = await createRoot();
    const stateDirectory = productionStateDirectory(project);
    await fs.mkdir(stateDirectory, { recursive: true });
    await fs.writeFile(path.join(stateDirectory, "execution.lock"), "");

    expect(await acquireProductionExecutionLease(project)).toBeNull();
  });
});
