import { describe, expect, it } from "vitest";

import {
  classifyProductionAction,
  policyLevelForCategory,
} from "@/lib/roadmap-production/policy";

describe("motor de políticas da Produção", () => {
  it("autoriza somente tools e gates explicitamente allowlisted", () => {
    expect(
      classifyProductionAction({
        action: "ler arquivo",
        tool: "read_file",
        path: "src/app/page.tsx",
        root: process.cwd(),
      }).level,
    ).toBe("SAFE");
    expect(classifyProductionAction({ action: "npm run typecheck" }).level).toBe(
      "SAFE",
    );
    expect(classifyProductionAction({ action: "execute qualquer shell" }).level).toBe(
      "SENSITIVE",
    );
  });

  it("exige intervenção para rede, dependência, credencial e elevação", () => {
    for (const action of [
      "npm install pacote",
      "curl https://example.com",
      "usar credencial configurada",
      "executar comando elevado",
    ]) {
      expect(classifyProductionAction({ action }).level).toBe("SENSITIVE");
    }
  });

  it("mantém banco, destruição, Git remoto e saída do workspace proibidos", () => {
    for (const action of [
      "alterar prisma/schema.prisma",
      "prisma migrate deploy",
      "git push origin main",
      "rm -rf src",
    ]) {
      expect(classifyProductionAction({ action }).level).toBe("FORBIDDEN");
    }
    expect(
      classifyProductionAction({
        action: "escrever arquivo",
        tool: "create_file",
        path: "../outside.txt",
        root: process.cwd(),
      }).code,
    ).toBe("POLICY_OUTSIDE_WORKSPACE");
    expect(policyLevelForCategory("DATABASE")).toBe("FORBIDDEN");
  });
});
