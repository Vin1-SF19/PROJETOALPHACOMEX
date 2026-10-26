import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), modulo: vi.fn(), card: vi.fn(), listar: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: { bpmTarefa: { findMany: mocks.listar } } }));
vi.mock("@/lib/bpm/ownership", () => ({ checarAcessoModuloBpm: mocks.modulo, checarAcessoBpmCard: mocks.card }));
import { GET } from "@/app/api/bpm/tarefas/alertas/route";
import { paginaAlertasTarefasBpmSchema } from "@/lib/bpm/notificacoes-tarefas";
const tarefa = {
  id: "tarefa", cardId: "card", titulo: "Retornar Green Coast", descricao: "Conferir documentos",
  tipo: "LIGACAO", prioridade: "ALTA", alertaEm: new Date("2026-10-20T14:00:00Z"), prazo: new Date("2026-10-20T15:00:00Z"),
  responsavel: { nome: "Maria" }, card: { pipelineId: "pipeline", empresa: { razaoSocial: "Green Coast" },
    pipeline: { nome: "Comercial" }, etapa: { nome: "Em tratativa" }, responsavel: { nome: "Vitor" } },
};
const request = (query = "") => new Request(`https://alpha.test/api/bpm/tarefas/alertas${query}`);
describe("recuperação autorizada de alertas de tarefas", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    mocks.modulo.mockResolvedValue(true); mocks.card.mockResolvedValue({ autorizado: true }); mocks.listar.mockResolvedValue([tarefa]);
  });
  it("recupera inclusive alertas antigos já marcados, com contexto completo e sem mutações", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toContain("no-store");
    const data = paginaAlertasTarefasBpmSchema.parse(await response.json());
    expect(data.alertas[0]).toMatchObject({ titulo: tarefa.titulo, descricao: tarefa.descricao, empresaNome: "Green Coast", responsavelNome: "Maria", prazo: tarefa.prazo.toISOString() });
    const where = mocks.listar.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("alertaDisparadoEm");
    expect(where).toMatchObject({ status: "PENDENTE", tipo: { not: "CRM_PROXIMO_CONTATO" },
      OR: [{ responsavelId: 7 }, { responsavelId: null, card: { responsavelId: 7 } }],
      card: { status: { not: "ARQUIVADO" }, pipeline: { ativo: true } } });
    expect(mocks.card).toHaveBeenCalledWith("card", 7, "COMERCIAL", "visualizar");
  });
  it("não vaza tarefa com ACL revogada e reaproveita acesso por card", async () => {
    mocks.listar.mockResolvedValue([tarefa, { ...tarefa, id: "outra" }]); mocks.card.mockResolvedValue({ autorizado: false });
    expect(await (await GET(request())).json()).toEqual({ alertas: [], nextCursor: null });
    expect(mocks.card).toHaveBeenCalledOnce();
  });
  it("nega sessão ausente e permissão de módulo revogada antes de consultar tarefas", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    expect((await GET(request())).status).toBe(401);
    mocks.modulo.mockResolvedValue(false);
    expect((await GET(request())).status).toBe(403); expect(mocks.listar).not.toHaveBeenCalled();
  });
  it("pagina mesmo quando todos os cards desta página têm acesso revogado", async () => {
    mocks.listar.mockResolvedValue(Array.from({ length: 51 }, (_, i) => ({ ...tarefa, id: `task-${i}` })));
    mocks.card.mockResolvedValue({ autorizado: false });
    expect(await (await GET(request("?cursor=anterior"))).json()).toEqual({ alertas: [], nextCursor: "task-49" });
    expect(mocks.listar).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { gt: "anterior" } }), take: 51 }));
  });
  it("recupera timeout transitório reavaliando as permissões e preservando o cursor", async () => {
    vi.useFakeTimers();
    mocks.listar.mockRejectedValueOnce(new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }));
    const resultado = GET(request("?cursor=anterior"));
    await vi.advanceTimersByTimeAsync(250);
    const response = await resultado;
    expect(response.status).toBe(200);
    expect(paginaAlertasTarefasBpmSchema.parse(await response.json()).alertas).toHaveLength(1);
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.modulo).toHaveBeenCalledTimes(2);
    expect(mocks.listar).toHaveBeenCalledTimes(2);
    expect(mocks.listar.mock.calls[1][0].where.id).toEqual({ gt: "anterior" });
  });
  it("retorna 503 seguro com Retry-After após dois timeouts", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const detalhe = "host-do-banco-privado";
    mocks.modulo.mockRejectedValue({ message: detalhe, meta: { driverAdapterError: {
      cause: { code: "UND_ERR_CONNECT_TIMEOUT", message: detalhe },
    } } });
    const resultado = GET(request());
    await vi.advanceTimersByTimeAsync(250);
    const response = await resultado;
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.text()).not.toContain(detalhe);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(detalhe);
    expect(mocks.modulo).toHaveBeenCalledTimes(2);
    expect(mocks.listar).not.toHaveBeenCalled();
  });
  it("respeita permissão revogada durante a espera, sem devolver os alertas", async () => {
    vi.useFakeTimers();
    mocks.listar.mockRejectedValueOnce({ cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
    mocks.modulo.mockResolvedValueOnce(true).mockResolvedValue(false);
    const resultado = GET(request());
    await vi.advanceTimersByTimeAsync(250);
    expect((await resultado).status).toBe(403);
    expect(mocks.listar).toHaveBeenCalledOnce();
  });
  it("refaz a ACL do card após timeout sem reutilizar promessas rejeitadas", async () => {
    vi.useFakeTimers();
    mocks.card.mockRejectedValueOnce({ cause: { code: "UND_ERR_CONNECT_TIMEOUT" } })
      .mockResolvedValueOnce({ autorizado: false });
    const resultado = GET(request());
    await vi.advanceTimersByTimeAsync(250);
    const response = await resultado;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ alertas: [], nextCursor: null });
    expect(mocks.card).toHaveBeenCalledTimes(2);
  });
  it("mantém erro permanente como 500 sem repetir e valida cursor antes de ler tarefas", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.listar.mockRejectedValue(new Error("falha inesperada"));
    expect((await GET(request())).status).toBe(500);
    expect(mocks.listar).toHaveBeenCalledOnce();
    expect((await GET(request(`?cursor=${"x".repeat(201)}`))).status).toBe(400);
    expect(mocks.listar).toHaveBeenCalledOnce();
  });
});
