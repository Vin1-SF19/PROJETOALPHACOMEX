import { describe, expect, it } from "vitest";

import { assertTrustedExplorerMutationRequest, resolveExplorerRequestOrigin } from "@/lib/alpha-explorer/request-origin";

const origins = ["https://painel.alpha-comex.com", "https://stagealpha-sistema.alpak.ai"] as const;

describe("Alpha Explorer trusted request origin", () => {
  it("accepts the exact stage Origin behind an internal reverse-proxy URL", () => {
    const request = new Request("http://127.0.0.1:3005/api/alpha-explorer/smb/ticket", {
      method: "POST",
      headers: { origin: origins[1], "sec-fetch-site": "same-origin" },
    });
    expect(assertTrustedExplorerMutationRequest(request, origins)).toBe(origins[1]);
  });

  it("resolves an Origin-less GET from trusted forwarded headers", () => {
    const request = new Request("http://127.0.0.1:3005/api/alpha-explorer/smb/admin/status", {
      headers: { host: "127.0.0.1:3005", "x-forwarded-host": "stagealpha-sistema.alpak.ai", "x-forwarded-proto": "https" },
    });
    expect(resolveExplorerRequestOrigin(request, origins)).toBe(origins[1]);
  });

  it("accepts the original Panel origin and rejects unknown origins", () => {
    const production = new Request("http://127.0.0.1:3005/api/alpha-explorer/smb/ticket", {
      method: "POST",
      headers: { origin: origins[0], "sec-fetch-site": "same-origin" },
    });
    expect(assertTrustedExplorerMutationRequest(production, origins)).toBe(origins[0]);

    const unknown = new Request("http://127.0.0.1:3005/api/alpha-explorer/smb/ticket", {
      method: "POST",
      headers: { origin: "https://evil.example", "sec-fetch-site": "same-origin" },
    });
    expect(() => assertTrustedExplorerMutationRequest(unknown, origins)).toThrow("Origem não permitida");
  });
});
