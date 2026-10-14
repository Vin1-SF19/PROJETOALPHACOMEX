import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ pipelines: vi.fn(), setores: vi.fn(), usuarios: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { bpmPipeline: { findMany: m.pipelines }, setor: { findMany: m.setores }, usuarios: { findMany: m.usuarios } } }));
import { carregarEscopoLeituraBpm } from "@/lib/bpm/visao-equipe-server";
import { configuracaoVisaoEquipeSchema, lerConfiguracaoVisaoEquipe } from "@/lib/bpm/visao-equipe";
import { selecionarPaginaQuadro } from "@/lib/bpm/quadro-paginado";
const config = JSON.stringify({ version: 1, supervisores: [{ usuarioId: 7, setorIds: [3] }] });
beforeEach(() => {
  vi.clearAllMocks();
  m.pipelines.mockResolvedValue([{ id: "p1", visualizacaoConfigJson: config }, { id: "p2", visualizacaoConfigJson: null }]);
  m.setores.mockResolvedValue([{ id: 3, nome: "Comercial" }]);
  m.usuarios.mockResolvedValue([{ id: 9, role: "COMERCIAL" }, { id: 10, role: "Financeiro" }]);
});
it("configuração ausente ou inválida nunca concede supervisão", async () => {
  for (const json of [null, "{", '{"version":2,"supervisores":[{"usuarioId":7,"setorIds":[3]}]}']) expect(lerConfiguracaoVisaoEquipe(json).supervisores).toEqual([]);
  expect(configuracaoVisaoEquipeSchema.safeParse({ version: 1, supervisores: [{ usuarioId: 7, setorIds: [3] }, { usuarioId: 7, setorIds: [4] }] }).success).toBe(false);
  const scope = await carregarEscopoLeituraBpm(8, false, "p1", config);
  expect(scope.usuarioIds).toEqual([]); expect(m.usuarios).not.toHaveBeenCalled();
});
it("supervisão consulta apenas IDs dos setores nomeados e fica limitada ao pipeline", async () => {
  const scope = await carregarEscopoLeituraBpm(7, false);
  expect(scope.usuarioIds).toEqual([9]);
  expect(scope.where).toEqual({ AND: [{ OR: [
    { AND: [{ OR: [{ responsavelId: 7 }, { membros: { some: { userId: 7 } } }] }] },
    { pipelineId: "p1", AND: [{ OR: [{ responsavelId: 7 }, { membros: { some: { userId: 7 } } }, { responsavelId: { in: [9] } }, { membros: { some: { userId: { in: [9] } } } }] }] },
  ] }] });
});
it("admin preserva máximo global e recebe opções de todos os setores quando solicitado", async () => {
  expect((await carregarEscopoLeituraBpm(7, true)).where).toEqual({});
  expect(m.pipelines).not.toHaveBeenCalled();
  const scope = await carregarEscopoLeituraBpm(7, true, "p1", null, undefined, true);
  expect(scope.where).toEqual({}); expect(scope.setores[0].usuarioIds).toEqual([9]);
});
it("todos iniciam com próprios e livres; filtros de equipe e setor não ampliam o máximo recebido", () => {
  const entradas = [7, 9, 10, null].map((uid, i) => ({ id: `c${i}`, etapaId: "e", revision: "1", nome: "Empresa", cnpj: null, servico: null, responsaveis: uid ? [{ id: uid, nome: "Pessoa" }] : [] }));
  const acesso = { userId: 7, admin: true, setores: [{ id: 3, nome: "Comercial", usuarioIds: [9] }] };
  expect(selecionarPaginaQuadro(entradas, { acesso }).ids).toEqual(["c0", "c3"]);
  expect(selecionarPaginaQuadro(entradas, { acesso, visao: "TODOS" }).ids).toHaveLength(4);
  expect(selecionarPaginaQuadro(entradas, { acesso: { ...acesso, admin: false }, visao: "EQUIPE" }).ids).toEqual(["c0", "c1", "c3"]);
  expect(selecionarPaginaQuadro(entradas, { acesso, visao: "SETOR", setorId: 3 }).ids).toEqual(["c1", "c3"]);
  expect(selecionarPaginaQuadro(entradas, { acesso: { ...acesso, admin: false }, visao: "TODOS" }).ids).toEqual(["c0", "c3"]);
});
