import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { executeProductionTool, type ProductionToolContext } from "@/lib/roadmap-production/tools";

let project = "";
let context: ProductionToolContext;
beforeEach(async () => {
  project = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-tools-"));
  await fs.mkdir(path.join(project, "src"));
  await fs.mkdir(path.join(project, "prisma"));
  await fs.writeFile(path.join(project, "src", "example.ts"), "export const value = 1;\n", "utf8");
  await fs.writeFile(path.join(project, ".env.local"), "TOKEN=secret\n", "utf8");
  await fs.writeFile(path.join(project, "prisma", "schema.prisma"), "datasource db {}\n", "utf8");
  context = { root: project, agentId: "nova", allowWrite: true };
});
afterEach(async () => { await fs.rm(project, { recursive: true, force: true }); });

async function call(name: string, args: Record<string, unknown>, override: Partial<ProductionToolContext> = {}) {
  return JSON.parse(await executeProductionTool({ name, arguments: args }, { ...context, ...override })) as { success?: boolean; errorCode?: string; content?: string };
}

describe("tools confinadas da Produção", () => {
  it("bloqueia traversal, segredos e schema do banco", async () => {
    expect((await call("read_file", { path: "../outside.txt" })).errorCode).toBe("UNSAFE_PATH");
    expect((await call("read_file", { path: ".env.local" })).errorCode).toBe("PROTECTED_PATH");
    expect((await call("replace_in_file", { path: "prisma/schema.prisma", oldText: "db", newText: "other" })).errorCode).toBe("DATABASE_CHANGE_REQUIRES_APPROVAL");
  });

  it("impede escrita em fase read-only", async () => {
    expect((await call("replace_in_file", { path: "src/example.ts", oldText: "1", newText: "2" }, { allowWrite: false })).errorCode).toBe("AGENT_READ_ONLY");
  });

  it("faz substituição exata e não sobrescreve criação", async () => {
    expect((await call("replace_in_file", { path: "src/example.ts", oldText: "value = 1", newText: "value = 2" })).success).toBe(true);
    expect(await fs.readFile(path.join(project, "src", "example.ts"), "utf8")).toContain("value = 2");
    expect((await call("create_file", { path: "src/example.ts", content: "bad" })).errorCode).toBe("TOOL_FAILED");
  });

  it("não oferece execução arbitrária", async () => {
    expect((await call("run_check", { check: "shell", paths: [] })).errorCode).toBe("CHECK_NOT_ALLOWED");
    expect((await call("unknown", {})).errorCode).toBe("UNKNOWN_TOOL");
  });
});
