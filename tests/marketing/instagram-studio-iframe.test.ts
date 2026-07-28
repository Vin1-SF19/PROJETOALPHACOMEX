import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const marketingClientSource = readFileSync(
  resolve(process.cwd(), "src/app/PainelAlpha/Marketing/MarketingClient.tsx"),
  "utf8",
);

describe("iframe do Instagram Studio", () => {
  it("mantém o sandbox com somente as permissões necessárias para o download", () => {
    const sandboxValue = marketingClientSource.match(/sandbox="([^"]+)"/)?.[1];

    expect(sandboxValue).toBeDefined();

    const sandboxTokens = sandboxValue?.split(/\s+/);

    expect(sandboxTokens).toEqual([
      "allow-same-origin",
      "allow-scripts",
      "allow-forms",
      "allow-downloads",
      "allow-top-navigation-by-user-activation",
    ]);
    expect(sandboxTokens).not.toContain("allow-top-navigation");
  });
});
