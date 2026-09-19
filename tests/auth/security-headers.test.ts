import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("hardening HTTP global", () => {
  it("reduz o limite de Server Actions sem quebrar o upload legado de 25 MB", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("30mb");
  });

  it("publica headers defensivos compatíveis com iframes da mesma origem", async () => {
    const entries = await nextConfig.headers();
    const headers = Object.fromEntries(entries[0].headers.map(({ key, value }) => [key, value]));

    expect(headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
    expect(headers["Permissions-Policy"]).not.toContain("microphone=()");
  });
});
