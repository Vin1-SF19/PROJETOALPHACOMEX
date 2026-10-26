import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encode, decode } from "next-auth/jwt";

const state = vi.hoisted(() => ({
  findUnique: vi.fn(),
  createLink: vi.fn(),
  updateUser: vi.fn(),
  updateMany: vi.fn(),
  requestHeaders: new Headers(),
}));
vi.mock("@/lib/prisma", () => ({ default: {
  usuarios: { findUnique: state.findUnique, update: state.updateUser, updateMany: state.updateMany },
  linkExterno: { create: state.createLink },
} }));
vi.mock("@/lib/user", () => ({ findUserByCredentials: vi.fn() }));
vi.mock("@/lib/auth/rate-limit", () => ({ clearAuthRateLimit: vi.fn(), consumeAuthRateLimit: vi.fn(), getAuthRequestAddress: vi.fn(), normalizeAuthIdentifier: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => state.requestHeaders }));

import { handlers, auth, authComEstadoAcesso } from "../../auth";
import { AUTH_PENDING_READ_LIMIT, AUTH_VALIDATION_BUDGET_MS, revalidarTokenAcesso } from "@/lib/auth/acesso-painel";
import { sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";
import { resultado } from "@/lib/checklist/result";
import { resultHttp } from "@/lib/checklist/http";
import { CriarLinkExterno } from "@/actions/LinksExternos";
import { POST as marcarOnboarding } from "@/app/api/onboarding/marcar-visto/route";
import { POST as heartbeat } from "@/app/api/heartbeat/route";
import { GET as consultarReceita } from "@/app/api/ReceitaFederal/route";
import { middleware } from "../../middleware";

const secret = process.env.AUTH_SECRET!;
const name = "__Secure-authjs.session-token";
const initial = { sub: "7", id: "7", role: "Admin", email: "controlled@example.test", authSessionVersion: 1 };

async function cookie(token: Record<string, unknown> = initial) {
  return `${name}=${await encode({ token, secret, salt: name })}`;
}
function request(cookieValue: string, method = "GET", body?: object) {
  return new NextRequest("https://auth.invalid/api/auth/session", {
    method, headers: { cookie: cookieValue, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}
function sessionCookie(response: Response): string {
  const values = response.headers.getSetCookie();
  expect(values.join(";")).not.toContain("Max-Age=0");
  const value = values.find((v) => v.startsWith(`${name}=`));
  expect(value).toBeDefined();
  return value!.split(";")[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  state.findUnique.mockResolvedValue({ status: "ATIVO", authSessionVersion: 1 });
});
afterEach(() => vi.useRealTimers());

describe("actual Auth.js handlers and safe server facade", () => {
  it("never accepts a client session with unknown or denied access state as login confirmation", () => {
    for (const estadoAcesso of [undefined, "NEGADO", "INDISPONIVEL", "unknown"]) {
      expect(sessaoPermiteOperacao({ user: { id: "7" }, estadoAcesso, acessoBloqueado: false })).toBe(false);
    }
  });
  it("GET preserves encrypted identity during failure, hides public user, then recovers using the same cookie", async () => {
    state.findUnique.mockRejectedValue(new Error("DB unavailable"));
    const response = await handlers.GET(request(await cookie()));
    expect(response.status).toBe(200);
    const dto = await response.json();
    expect(dto).toMatchObject({ estadoAcesso: "INDISPONIVEL", acessoBloqueado: false });
    expect(dto.user).toBeUndefined();
    expect(sessaoPermiteOperacao(dto)).toBe(false);
    const preservedCookie = sessionCookie(response);
    const token = await decode({ token: preservedCookie.slice(name.length + 1), secret, salt: name });
    expect(token).toMatchObject({ ...initial, estadoAcesso: "INDISPONIVEL" });
    state.findUnique.mockResolvedValue({ status: "ATIVO", authSessionVersion: 1 });
    const recovered = await handlers.GET(request(preservedCookie));
    expect(await recovered.json()).toMatchObject({ estadoAcesso: "PERMITIDO", user: { id: "7", role: "Admin" } });
  });

  it("RSC explicit reader hides identity too; facade rejects before a protected write", async () => {
    state.requestHeaders = new Headers({ cookie: await cookie() });
    state.findUnique.mockRejectedValue(new Error("DB unavailable"));
    const dto = await authComEstadoAcesso();
    expect(dto?.user).toBeUndefined();
    expect(dto?.estadoAcesso).toBe("INDISPONIVEL");
    const write = vi.fn();
    const action = async () => { const session = await auth(); if (session) write(); };
    await expect(action()).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE" });
    expect(write).not.toHaveBeenCalled();
    const enveloped = await resultado(action);
    expect(enveloped).toMatchObject({ ok: false, error: { code: "AUTH_UNAVAILABLE" } });
    const response = resultHttp(enveloped);
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
  });

  it("real server action and direct REST handler deny before side effects; heartbeat503 never writes", async () => {
    state.requestHeaders = new Headers({ cookie: await cookie() });
    state.findUnique.mockRejectedValue(new Error("controlled failure"));
    await expect(CriarLinkExterno({ label: "Controlado", url: "https://example.invalid", iconName: "Link", visivelPara: "TODOS" })).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE" });
    expect(state.createLink).not.toHaveBeenCalled();
    const denied = await marcarOnboarding();
    expect(denied.status).toBe(503);
    expect(denied.headers.get("Cache-Control")).toContain("no-store");
    expect(await denied.json()).toMatchObject({ code: "AUTH_UNAVAILABLE", retryable: true });
    expect(state.updateUser).not.toHaveBeenCalled();
    expect((await heartbeat()).status).toBe(503);
    expect(state.updateMany).not.toHaveBeenCalled();
  });

  it("indirect pre-analysis auth survives the route generic catch as503", async () => {
    state.requestHeaders = new Headers({ cookie: await cookie() });
    state.findUnique.mockRejectedValue(new Error("controlled failure"));
    const response = await consultarReceita(new Request("https://auth.invalid/api/ReceitaFederal?cnpj=123"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "AUTH_UNAVAILABLE" });
  });

  it("middleware admits a temporary cookie only as a prefilter, and rejects definitively blocked cookies", async () => {
    const middlewareCookie = async (token: Record<string, unknown>) =>
      `authjs.session-token=${await encode({ token, secret, salt: "authjs.session-token" })}`;
    const temporary = new NextRequest("https://auth.invalid/PainelAlpha/AlphaCRM", {
      headers: { cookie: await middlewareCookie({ ...initial, estadoAcesso: "INDISPONIVEL" }) },
    });
    expect((await middleware(temporary)).headers.get("x-middleware-next")).toBe("1");
    expect(state.findUnique).not.toHaveBeenCalled();
    const blocked = new NextRequest("https://auth.invalid/PainelAlpha/AlphaCRM", {
      headers: { cookie: await middlewareCookie({ acessoBloqueado: true, estadoAcesso: "NEGADO" }) },
    });
    expect((await middleware(blocked)).headers.get("location")).toBe("https://auth.invalid/");
  });

  it.each([{ status: "INATIVO", authSessionVersion: 1 }, null, { status: "ATIVO", authSessionVersion: 2 }])(
    "never resurrects definitively revoked identity: %j", async (record) => {
      state.findUnique.mockResolvedValue(record);
      const response = await handlers.GET(request(await cookie()));
      expect(await response.json()).toMatchObject({ estadoAcesso: "NEGADO", acessoBloqueado: true });
      const deniedCookie = sessionCookie(response);
      state.findUnique.mockResolvedValue({ status: "ATIVO", authSessionVersion: 1 });
      state.findUnique.mockClear();
      expect(await (await handlers.GET(request(deniedCookie))).json()).toMatchObject({ acessoBloqueado: true });
      expect(state.findUnique).not.toHaveBeenCalled();
    },
  );

  it("POST session update cannot forge permission, version or temporary flags", async () => {
    const originalCookie = await cookie();
    const csrf = await handlers.GET(new NextRequest("https://auth.invalid/api/auth/csrf"));
    const { csrfToken } = await csrf.json();
    const csrfCookies = csrf.headers.getSetCookie().map((v) => v.split(";")[0]).join("; ");
    const response = await handlers.POST(request(`${originalCookie}; ${csrfCookies}`, "POST", {
      csrfToken,
      data: { estadoAcesso: "PERMITIDO", acessoBloqueado: false, user: { id: "999", role: "Admin", authSessionVersion: 2, estadoAcesso: "PERMITIDO" } },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: "7", authSessionVersion: 1 } });
    state.findUnique.mockRejectedValue(new Error("temporary"));
    const unavailable = await handlers.POST(request(`${originalCookie}; ${csrfCookies}`, "POST", {
      csrfToken, data: { user: { role: "Admin", estadoAcesso: "PERMITIDO" } },
    }));
    expect(await unavailable.json()).toMatchObject({ estadoAcesso: "INDISPONIVEL" });
    const preserved = await decode({ token: sessionCookie(unavailable).slice(name.length + 1), secret, salt: name });
    expect(preserved).toMatchObject({ id: "7", authSessionVersion: 1, estadoAcesso: "INDISPONIVEL" });
  });

  it.each([{ id: "", authSessionVersion: 1 }, { id: "7", authSessionVersion: NaN }, { id: "7", authSessionVersion: -1 }, { id: "7" }, { id: "7", authSessionVersion: "1" }])(
    "rejects malformed claims before touching DB: %j", async (token) => {
      expect(await revalidarTokenAcesso(token)).toMatchObject({ acessoBloqueado: true });
      expect(state.findUnique).not.toHaveBeenCalled();
    },
  );

  it("retries only its safe access read, at most once", async () => {
    vi.useFakeTimers();
    state.findUnique.mockRejectedValue(new TypeError("fetch failed"));
    const result = revalidarTokenAcesso(initial);
    await vi.runAllTimersAsync();
    expect(await result).toMatchObject({ estadoAcesso: "INDISPONIVEL", id: "7" });
    expect(state.findUnique).toHaveBeenCalledTimes(2);
  });

  it("bounds observers and admission while the SDK queue is stuck, holds slots until actual settlement and ignores late outcomes", async () => {
    vi.useFakeTimers();
    const resolvers: ((record: { status: string; authSessionVersion: number }) => void)[] = [];
    state.findUnique.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));
    const calls = Array.from({ length: AUTH_PENDING_READ_LIMIT + 4 }, (_, index) =>
      revalidarTokenAcesso({ ...initial, id: String(index + 10) }));
    expect(state.findUnique).toHaveBeenCalledTimes(AUTH_PENDING_READ_LIMIT);
    await vi.advanceTimersByTimeAsync(AUTH_VALIDATION_BUDGET_MS);
    const tokens = await Promise.all(calls);
    expect(tokens.every((token) => token.estadoAcesso === "INDISPONIVEL" && token.id && !token.acessoBloqueado)).toBe(true);
    // Expiration did not free capacity or permit another retry/queued query.
    expect(await revalidarTokenAcesso(initial)).toMatchObject({ estadoAcesso: "INDISPONIVEL" });
    expect(state.findUnique).toHaveBeenCalledTimes(AUTH_PENDING_READ_LIMIT);
    resolvers.forEach((resolve, index) => resolve({ status: index ? "ATIVO" : "INATIVO", authSessionVersion: 1 }));
    await vi.runAllTimersAsync();
    expect(tokens.every((token) => token.estadoAcesso === "INDISPONIVEL")).toBe(true);
    state.findUnique.mockResolvedValue({ status: "ATIVO", authSessionVersion: 1 });
    expect(await revalidarTokenAcesso(initial)).toMatchObject({ estadoAcesso: "PERMITIDO" });
  });
});
