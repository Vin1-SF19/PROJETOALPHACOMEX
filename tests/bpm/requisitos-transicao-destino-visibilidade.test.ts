import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), card: vi.fn(), etapa: vi.fn(), transicao: vi.fn(), campos: vi.fn(), usuarios: vi.fn(), valores: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCard: { findUnique: m.card }, bpmEtapa: { findUnique: m.etapa }, bpmTransicaoEtapa: { findUnique: m.transicao },
  bpmCampo: { findMany: m.campos }, bpmCardCampoValor: { findMany: m.valores }, usuarios: { findMany: m.usuarios },
} }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: m.acesso }));
vi.mock("@/lib/bpm/campos-formulario-publicado", () => ({
  camposPublicadosPorEtapa: async () => new Map([["destino", new Set(["vendedor"])]]),
  capacidadesObrigatoriasPorEtapa: async () => new Map(),
}));
import { ObterRequisitosTransicaoBpm } from "@/actions/bpm/Cards";
const destino = (podeVer: boolean, podeAgir = false) => ({ id: "destino", nome: "Destino", pipelineId: "pipeline",
  visibilidades: [{ perfil: "Comercial", podeVer, podeAgir }] });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "7", role: "Comercial" } });
  m.acesso.mockResolvedValue({ isAdminGlobal: false, role: "RESPONSAVEL", perfilGlobal: "Comercial" });
  m.card.mockResolvedValue({ id: "card", pipelineId: "pipeline", etapaId: "origem", responsavelId: 42,
    etapa: { nome: "Origem", chave: "origem" }, pipeline: { nome: "Outro pipeline" }, empresa: { pessoas: [] },
    dataReuniao: null, proximoContatoEm: null });
  m.etapa.mockResolvedValue(destino(false));
  m.transicao.mockResolvedValue({ permitida: true, origem: "AMBOS" });
  m.campos.mockImplementation(async ({ where }) => where.etapaConfiguracoes.some.etapaId === "destino" ? [{
    id: "vendedor", nome: "Vendedor responsável", pipelineId: "pipeline", etapaId: null, tipo: "usuario", escopo: "GLOBAL",
    fonteEntidade: "CARD", fonteAtributo: "responsavelId", opcoesJson: null, obrigatorio: false, ordem: 0,
    editavel: true, somenteLeitura: false,
    etapaConfiguracoes: [{ etapaId: "destino", visivel: true, editavel: true, somenteLeitura: false,
      obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false, ordem: 0 }],
  }] : []);
  m.valores.mockResolvedValue([]); m.usuarios.mockResolvedValue([{ id: 42, nome: "Nome da referência" }]);
});
it("nega destino oculto antes de carregar campos ou consultar nomes, mesmo com origem e aresta permitidas", async () => {
  expect(await ObterRequisitosTransicaoBpm("card", "destino")).toEqual({ success: false, error: "Não autorizado" });
  expect(m.acesso).toHaveBeenCalledWith("card", 7, "Comercial", "visualizar");
  expect(m.transicao).toHaveBeenCalledOnce(); expect(m.campos).not.toHaveBeenCalled(); expect(m.usuarios).not.toHaveBeenCalled();
});
it("destino visível permite leitura de nome/ID sem exigir podeAgir", async () => {
  m.etapa.mockResolvedValue(destino(true, false));
  expect(await ObterRequisitosTransicaoBpm("card", "destino")).toMatchObject({ success: true, data: { campos: [{
    id: "vendedor", valor: "42", valorExibicao: "Nome da referência",
  }] } });
  expect(m.usuarios).toHaveBeenCalledExactlyOnceWith({ where: { id: { in: [42] } }, select: { id: true, nome: true } });
});
it("preserva acesso administrativo global ao destino", async () => {
  m.acesso.mockResolvedValue({ isAdminGlobal: true, role: "ADMINISTRADOR", perfilGlobal: "TI" });
  expect(await ObterRequisitosTransicaoBpm("card", "destino")).toMatchObject({ success: true });
  expect(m.usuarios).toHaveBeenCalledOnce();
});
