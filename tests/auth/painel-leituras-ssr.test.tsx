import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), permissions: vi.fn(), user: vi.fn(), links: vi.fn(), video: vi.fn(),
  redirect: vi.fn((path: string): never => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));
vi.mock("../../auth", () => ({ authComEstadoAcesso: mocks.session }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/actions/PermissoesSetor", () => ({ getPermissoesEfetivas: mocks.permissions }));
vi.mock("@/actions/LinksExternos", () => ({ ListarLinksExternosVisiveis: mocks.links }));
vi.mock("@/lib/onboarding", () => ({ getOnboardingVideo: mocks.video }));
vi.mock("@/lib/prisma", () => ({ default: { usuarios: { findUnique: mocks.user } } }));
vi.mock("@/components/layout/PainelLayoutClient", () => ({ default: () => null }));
vi.mock("@/components/layout/PainelEmbeddedReady", () => ({ PainelEmbeddedReady: () => null }));
vi.mock("@/components/auth/SessaoIndisponivel", () => ({ SessaoIndisponivel: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardModalHost", () => ({ PainelCardState: () => null }));

import { lerDadosLayoutPainel, PAINEL_SSR_PENDING_GROUP_LIMIT, PAINEL_SSR_READ_BUDGET_MS } from "@/lib/painel-leituras-ssr";
import PainelLayout from "@/app/PainelAlpha/layout";
import { SessaoIndisponivel } from "@/components/auth/SessaoIndisponivel";

type Usuario = { status: string; role: string; tema_interface: string; onboarding_ialpha_visto: boolean };
const active: Usuario = { status: "ATIVO", role: "User", tema_interface: "blue", onboarding_ialpha_visto: true };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}
const reads = () => ({
  permissoes: mocks.permissions as () => Promise<string[]>,
  usuario: mocks.user as () => Promise<Usuario | null>,
  links: mocks.links as () => Promise<string[]>,
  usuarioPermitido: (record: Usuario) => record.status === "ATIVO",
  onboarding: mocks.video as () => Promise<string | null>,
});

beforeEach(() => {
  vi.useFakeTimers();
  for (const mock of [mocks.session, mocks.permissions, mocks.user, mocks.links, mocks.video]) mock.mockReset();
  mocks.redirect.mockClear();
  mocks.session.mockResolvedValue({ estadoAcesso: "PERMITIDO", user: { id: "7", role: "User" } });
  mocks.permissions.mockResolvedValue(["checkList"]);
  mocks.user.mockResolvedValue(active);
  mocks.links.mockResolvedValue([]);
  mocks.video.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

describe("read-only SSR aggregation and protected layout", () => {
  it("accepts initial reads slower than5s within the20s observer", async () => {
    mocks.links.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(["link"]), 5_502)));
    const pending = lerDadosLayoutPainel(reads());
    await vi.advanceTimersByTimeAsync(5_502);
    expect(await pending).toMatchObject({ estado: "PERMITIDO", links: ["link"] });
    expect(PAINEL_SSR_READ_BUDGET_MS).toBe(20_000);
  });
  it("starts only admitted groups, bounds waiting and holds capacity until every queued read settles", async () => {
    const permissions = deferred<string[]>(), user = deferred<Usuario | null>(), links = deferred<string[]>();
    mocks.permissions.mockReturnValue(permissions.promise);
    mocks.user.mockReturnValue(user.promise);
    mocks.links.mockReturnValue(links.promise);
    const pending = Array.from({ length: PAINEL_SSR_PENDING_GROUP_LIMIT + 3 }, () => lerDadosLayoutPainel(reads()));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.permissions).toHaveBeenCalledTimes(PAINEL_SSR_PENDING_GROUP_LIMIT);
    expect(mocks.user).toHaveBeenCalledTimes(PAINEL_SSR_PENDING_GROUP_LIMIT);
    expect(mocks.links).toHaveBeenCalledTimes(PAINEL_SSR_PENDING_GROUP_LIMIT);
    await vi.advanceTimersByTimeAsync(PAINEL_SSR_READ_BUDGET_MS);
    const expired = await Promise.all(pending);
    expect(expired.every((result) => result.estado === "INDISPONIVEL")).toBe(true);
    expect(await lerDadosLayoutPainel(reads())).toEqual({ estado: "INDISPONIVEL" });
    expect(mocks.user).toHaveBeenCalledTimes(PAINEL_SSR_PENDING_GROUP_LIMIT);
    // Settling only two reads must not release any group or start late onboarding.
    user.resolve(active);
    permissions.resolve([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(await lerDadosLayoutPainel(reads())).toEqual({ estado: "INDISPONIVEL" });
    expect(mocks.video).not.toHaveBeenCalled();
    links.resolve([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(expired.every((result) => result.estado === "INDISPONIVEL")).toBe(true);
    expect((await lerDadosLayoutPainel(reads())).estado).toBe("PERMITIDO");
  });

  it("does not release on first rejection while sibling reads are still waiting", async () => {
    const links = deferred<string[]>();
    mocks.permissions.mockRejectedValue(new Error("controlled read failure"));
    mocks.links.mockReturnValue(links.promise);
    const pending = Array.from({ length: PAINEL_SSR_PENDING_GROUP_LIMIT }, () => lerDadosLayoutPainel(reads()));
    await vi.advanceTimersByTimeAsync(PAINEL_SSR_READ_BUDGET_MS);
    expect((await Promise.all(pending)).every((result) => result.estado === "INDISPONIVEL")).toBe(true);
    expect(await lerDadosLayoutPainel(reads())).toEqual({ estado: "INDISPONIVEL" });
    expect(mocks.user).toHaveBeenCalledTimes(PAINEL_SSR_PENDING_GROUP_LIMIT);
    links.resolve([]);
    await vi.advanceTimersByTimeAsync(0);
    mocks.permissions.mockResolvedValue([]);
    expect((await lerDadosLayoutPainel(reads())).estado).toBe("PERMITIDO");
  });

  it("renders the Nova recovery view when onboarding hangs and never replaces that response with late protected content", async () => {
    const video = deferred<null>();
    mocks.user.mockResolvedValue({ ...active, onboarding_ialpha_visto: false });
    mocks.video.mockReturnValue(video.promise);
    const pending = PainelLayout({ children: <div>protected content</div> });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.video).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(PAINEL_SSR_READ_BUDGET_MS);
    const response = await pending;
    expect(response.type).toBe(SessaoIndisponivel);
    expect(response.props.children).toBeUndefined();
    video.resolve(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(response.type).toBe(SessaoIndisponivel);
    expect((await PainelLayout({ children: <div>protected content</div> })).type).not.toBe(SessaoIndisponivel);
  });

  it.each([null, { ...active, status: "INATIVO" }])("redirects a confirmed denied user outside the recoverable catch: %j", async (record) => {
    const permissions = deferred<string[]>(), links = deferred<string[]>();
    mocks.permissions.mockReturnValue(permissions.promise);
    mocks.links.mockReturnValue(links.promise);
    mocks.user.mockResolvedValue(record);
    const pending = PainelLayout({ children: <div>protected content</div> });
    const denied = expect(pending).rejects.toThrow("NEXT_REDIRECT:/?acesso=bloqueado");
    await vi.advanceTimersByTimeAsync(0);
    await denied;
    expect(mocks.redirect).toHaveBeenCalledWith("/?acesso=bloqueado");
    expect(mocks.video).not.toHaveBeenCalled();
    permissions.resolve([]); links.resolve([]);
    await vi.advanceTimersByTimeAsync(0);
  });
});
