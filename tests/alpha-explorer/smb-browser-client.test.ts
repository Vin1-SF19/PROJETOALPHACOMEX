import { afterEach, describe, expect, it, vi } from "vitest";

import { getSmbLinkStatus } from "@/lib/alpha-explorer/smb/browser-client";
import {
  getSmbAdminCredentialStatus,
  unlinkSmbAdminCredential,
  writeSmbAdminCredential,
} from "@/lib/alpha-explorer/smb/admin-browser-client";

const issuedTicket = {
  success: true,
  data: {
    token: "synthetic-ticket-that-is-long-enough-for-validation",
    expiresAt: "2026-09-15T21:30:45.000Z",
    gatewayUrl: "https://files.example.test",
  },
};
const adminIssuedTicket = {
  ...issuedTicket,
  supportId: "5b73320b-e12b-4bb2-bfab-fb2e8bdba99e",
};

afterEach(() => vi.unstubAllGlobals());

describe("Alpha Explorer SMB browser client", () => {
  it("sends an administrator-provided QNAP password directly to the gateway, never to the Painel", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      if (calls.length === 1) return Response.json(adminIssuedTicket);
      return Response.json({ ok: true, linked: true, supportId: "8d49f0d6-51df-4f82-9210-f70eaf0d08c9" }, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await writeSmbAdminCredential({
      targetUserId: 42,
      mode: "enroll",
      principal: "maria",
      password: "senha-sintetica",
    });

    expect(calls[0]?.url).toBe("/api/alpha-explorer/smb/admin/ticket");
    expect(String(calls[0]?.init?.body)).not.toContain("senha-sintetica");
    expect(String(calls[0]?.init?.body)).toContain('"targetUserId":42');
    expect(String(calls[0]?.init?.body)).not.toContain("justification");
    expect(calls[1]?.url).toBe("https://files.example.test/v1/admin/credentials/enroll");
    expect(String(calls[1]?.init?.body)).toContain("senha-sintetica");
    expect(new Headers(calls[1]?.init?.headers).get("authorization")).toContain("Bearer ");
  });

  it("returns only the linked state and validates the gateway response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(issuedTicket))
      .mockResolvedValueOnce(Response.json({ linked: true, supportId: "8d49f0d6-51df-4f82-9210-f70eaf0d08c9" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getSmbLinkStatus()).resolves.toBe(true);
  });

  it("reads administrator status through the control plane so metadata can be reconciled", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({
      linked: true,
      principal: "maria",
      credentialVersion: 2,
      supportId: "8d49f0d6-51df-4f82-9210-f70eaf0d08c9",
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getSmbAdminCredentialStatus(42)).resolves.toMatchObject({ linked: true, credentialVersion: 2 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/alpha-explorer/smb/admin/status?targetUserId=42",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("administratively unlinks through a target-bound ticket without sending a NAS credential", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      if (calls.length === 1) return Response.json(adminIssuedTicket);
      return Response.json({ ok: true, linked: false, supportId: "8d49f0d6-51df-4f82-9210-f70eaf0d08c9" });
    }));
    await unlinkSmbAdminCredential({ targetUserId: 42 });
    expect(String(calls[0]?.init?.body)).toContain('"scope":"credential:unlink"');
    expect(calls[1]?.url).toBe("https://files.example.test/v1/admin/credentials");
    expect(calls[1]?.init?.method).toBe("DELETE");
    expect(String(calls[1]?.init?.body)).not.toContain("password");
    expect(String(calls[1]?.init?.body)).not.toContain("justification");
  });
});
