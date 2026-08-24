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
    for (const tool of ["search_code"] as const) {
      expect(
        classifyProductionAction({ action: tool, tool }).level,
      ).toBe("SAFE");
    }
    for (const staleTool of ["search_files", "run_quality_gate", "run_check"] as const) {
      expect(
        classifyProductionAction({ action: staleTool, tool: staleTool }).level,
      ).toBe("FORBIDDEN");
    }
    expect(classifyProductionAction({ action: "execute qualquer shell" }).level).toBe(
      "FORBIDDEN",
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

  it("aceita npm test somente com alvos seguros e rejeita composição de shells", () => {
    for (const action of [
      "npm test -- tests/roadmap-production/policy.test.ts",
      "npm test -- tests/a.test.ts tests/b.test.ts",
    ]) {
      expect(classifyProductionAction({ action }).level).toBe("SAFE");
    }
    for (const action of [
      "npm test -- tests/roadmap-production && whoami",
      "npm test -- tests/a.test.ts || whoami",
      "npm test -- tests/a.test.ts; Get-ChildItem",
      "npm test -- tests/a.test.ts | Out-File result.txt",
      "npm test -- tests/a.test.ts > result.txt",
      "npm test -- tests/a.test.ts < input.txt",
      "npm test -- tests/a.test.ts `whoami`",
      "npm test -- tests/a.test.ts $(whoami)",
      "npm test -- tests/a.test.ts\nwhoami",
      "npm test -- tests/a.test.ts & whoami",
      "npm test -- --runInBand",
      "npm test -- src/a.test.ts",
      "npm test -- tests/../src/a.test.ts",
      "npm test -- tests/*.test.ts",
      "cmd /c npm test",
      "powershell -Command npm test",
    ]) {
      expect(classifyProductionAction({ action }).level).toBe("FORBIDDEN");
    }
  });

  it("mantém banco, destruição, Git remoto e saída do workspace proibidos", () => {
    for (const action of [
      "alterar prisma/schema.prisma",
      "prisma migrate deploy",
      "npx prisma db push",
      "sqlite3 prisma/dev.db DELETE FROM users",
      "git push origin main",
      "git -C . push origin main",
      "git clean -fd",
      "rm -rf src",
      "Remove-Item arquivo.txt",
      "comando-desconhecido --write",
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
    for (const protectedPath of [
      ".env",
      ".env.local",
      ".git/config",
      ".npmrc",
      "prisma/schema.prisma",
      "database-backups/pre-change/dump.sql",
      "config/secrets-prod.json",
      "config/credentials.json",
      "keys/service-account-prod.json",
      "keys/private.pem",
      "keys/signing.key",
      "keys/bundle.p12",
    ]) {
      expect(
        classifyProductionAction({
          action: "read_file",
          tool: "read_file",
          path: protectedPath,
          root: process.cwd(),
        }).level,
      ).toBe("FORBIDDEN");
    }
    expect(policyLevelForCategory("DATABASE")).toBe("FORBIDDEN");
  });

});
