import { beforeEach, expect, it, vi } from "vitest";
import { gravarRegrasAcessoPipeline, type RegraAcessoPipeline } from "@/lib/bpm/acesso-pipeline";

const m = vi.hoisted(() => ({ auth: vi.fn(), modulo: vi.fn(), admin: vi.fn(), etapas: vi.fn(), cards: vi.fn(), tarefas: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {
  usuarios: { findUnique: async () => ({ role: "Comercial" }) },
  bpmEtapa: { findMany: m.etapas }, bpmCard: { findMany: m.cards }, bpmTarefa: { findMany: m.tarefas },
  cliente: { findUnique: async () => ({ id: 1 }) },
} }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoModuloBpm: m.modulo, checarAcessoConfigPipeline: m.admin,
  exigirAcessoBpmCard: vi.fn(), exigirAcessoBpmPipeline: vi.fn(), exigirAcessoConfigPipeline: vi.fn(),
}));
vi.mock("@/lib/bpm/visao-equipe-server", () => ({ carregarEscopoLeituraBpm: async () => ({ where: {} }) }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));

import { ListarTarefasGlobaisBpm } from "@/actions/bpm/Tarefas";
import { ObterPerfilEmpresaBpm } from "@/actions/bpm/Empresas";

function etapa(id: string, regras: RegraAcessoPipeline[], oculta = false) {
  return { id, pipeline: {
    visualizacaoConfigJson: gravarRegrasAcessoPipeline(null, regras),
    setores: [{ setor: { id: 3, nome: "Comercial", ativo: true } }],
  }, visibilidades: oculta ? [{ perfil: "FINANCEIRO", podeVer: true, podeAgir: true }] : [] };
}

beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "7" } }); m.admin.mockResolvedValue(false);
  m.cards.mockResolvedValue([]); m.tarefas.mockResolvedValue([]);
});

it("tarefas e perfil da empresa usam concessão setorial por ID e incluem coluna oculta somente para administrador do funil", async () => {
  m.etapas.mockResolvedValue([
    etapa("setor-padrao", [{ tipo: "SETOR", id: 3, nivel: "PADRAO" }]),
    etapa("setor-admin", [{ tipo: "SETOR", id: 3, nivel: "ADMINISTRATIVO" }], true),
    etapa("usuario-admin", [{ tipo: "USUARIO", id: 7, nivel: "ADMINISTRATIVO" }], true),
    etapa("coluna-oculta", [{ tipo: "SETOR", id: 3, nivel: "PADRAO" }], true),
    etapa("outro-setor", [{ tipo: "SETOR", id: 4, nivel: "ADMINISTRATIVO" }]),
    etapa("fechado", []),
  ]);
  expect(await ListarTarefasGlobaisBpm()).toMatchObject({ success: true });
  await ObterPerfilEmpresaBpm(1);
  const esperadas = ["setor-padrao", "setor-admin", "usuario-admin"];
  expect(m.tarefas.mock.calls.at(-1)?.[0].where.card.etapaId.in).toEqual(esperadas);
  expect(m.cards.mock.calls.at(-1)?.[0].where.etapaId.in).toEqual(esperadas);
  expect(m.etapas.mock.calls.at(-1)?.[0].select.pipeline.select.setores.select.setor.select).toMatchObject({ id: true, nome: true, ativo: true });
});

it("revogação do módulo impede ambas as consultas antes de ler etapas", async () => {
  m.modulo.mockRejectedValue(new Error("Não autorizado"));
  expect(await ListarTarefasGlobaisBpm()).toMatchObject({ success: false });
  expect(await ObterPerfilEmpresaBpm(1)).toMatchObject({ success: false });
  expect(m.etapas).not.toHaveBeenCalled();
});
