import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), modulo: vi.fn(), authorize: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { authorizeChannel: mocks.authorize } }));
vi.mock("@/lib/bpm/ownership", () => ({ checarAcessoModuloBpm: mocks.modulo, checarAcessoRealtimeBpmPipeline: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
import { POST } from "@/app/api/pusher/auth/route";
function request(id = "7") {
  const body = new FormData(); body.set("socket_id", "1.2"); body.set("channel_name", `private-bpm-tarefas-usuario-${id}`);
  return new Request("https://alpha.test/api/pusher/auth", { method: "POST", body });
}
describe("canal privado de alertas CRM", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "7" } });
    mocks.modulo.mockResolvedValue(true); mocks.authorize.mockReturnValue({ auth: "assinatura" });
  });
  it("autoriza somente o próprio usuário com acesso ativo ao CRM", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.modulo).toHaveBeenCalledWith(7);
    expect(mocks.authorize).toHaveBeenCalledWith("1.2", "private-bpm-tarefas-usuario-7");
  });
  it("nega outro usuário, canal malformado, sessão ausente e módulo revogado", async () => {
    for (const id of ["8", "7-extra", "0", "7.0"]) expect((await POST(request(id))).status).toBe(403);
    mocks.modulo.mockResolvedValue(false); expect((await POST(request())).status).toBe(403);
    mocks.auth.mockResolvedValue(null); expect((await POST(request())).status).toBe(401);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
});
