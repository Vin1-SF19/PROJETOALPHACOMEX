import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ pipeline: vi.fn(), usuarios: vi.fn(), permissoes: vi.fn(), overrides: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { bpmPipeline: { findUnique: m.pipeline }, usuarios: { findMany: m.usuarios }, setorPermissao: { findMany: m.permissoes }, usuarioPermissaoOverride: { findMany: m.overrides } } }));
import { carregarEscopoLeituraBpm } from "@/lib/bpm/visao-equipe-server";
import { configuracaoVisaoEquipeSchema, lerConfiguracaoVisaoEquipe } from "@/lib/bpm/visao-equipe";
import { selecionarPaginaQuadro } from "@/lib/bpm/quadro-paginado";
beforeEach(() => {
  vi.clearAllMocks();
  m.pipeline.mockResolvedValue({ setores: [{ setor: { id: 3, nome: "Comercial" } }] });
  m.usuarios.mockResolvedValue([
    { id: 9, nome: "Ana", role: "COMERCIAL", status: "ATIVO", permissoes: "crm" },
    { id: 10, nome: "Financeiro", role: "Financeiro", status: "ATIVO", permissoes: "crm" },
    { id: 11, nome: "Inativo", role: "Comercial", status: "INATIVO", permissoes: "crm" },
    { id: 12, nome: "Revogado", role: "Comercial", status: "ATIVO", permissoes: "crm" },
    { id: 13, nome: "Sem CRM", role: "Comercial", status: "ATIVO", permissoes: null },
    { id: 14, nome: "TI", role: "TI", status: "ATIVO", permissoes: null },
  ]);
  m.permissoes.mockResolvedValue([]);
  m.overrides.mockResolvedValue([{ usuarioId: 12, modulo: "crm", acao: "REMOVE" }]);
});
it("preserva validação da configuração legada sem depender dela para leitura", async () => {
  for (const json of [null, "{", '{"version":2,"supervisores":[]}']) {
    expect(lerConfiguracaoVisaoEquipe(json).supervisores).toEqual([]);
    expect((await carregarEscopoLeituraBpm(8, false, "p1", json)).where).toEqual({});
  }
  expect(configuracaoVisaoEquipeSchema.safeParse({ version: 1, supervisores: [{ usuarioId: 7, setorIds: [3] }, { usuarioId: 7, setorIds: [4] }] }).success).toBe(false);
  expect(m.usuarios).not.toHaveBeenCalled();
});
it.each([false, true])("lista só usuários ativos com CRM dos setores do pipeline, admin=%s", async (admin) => {
  const scope = await carregarEscopoLeituraBpm(8, admin, "p1", null, undefined, true);
  expect(scope).toMatchObject({ where: {}, usuarioIds: [9], responsaveis: [{ id: 9, nome: "Ana" }], setores: [{ id: 3, nome: "Comercial", usuarioIds: [9] }] });
  expect(m.pipeline).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1" } }));
});
it("pipeline sem setores lista todas as contas ativas com CRM e atualiza revogação", async () => {
  m.pipeline.mockResolvedValue({ setores: [] });
  expect((await carregarEscopoLeituraBpm(8, true, "p1", null, undefined, true)).usuarioIds).toEqual([9, 10, 14]);
  m.overrides.mockResolvedValue([{ usuarioId: 9, modulo: "crm", acao: "REMOVE" }, { usuarioId: 12, modulo: "crm", acao: "REMOVE" }]);
  expect((await carregarEscopoLeituraBpm(8, true, "p1", null, undefined, true)).usuarioIds).toEqual([10, 14]);
});
it("escopo de leitura preserva guardas do chamador sem consultas de opções", async () => {
  expect((await carregarEscopoLeituraBpm(7, false)).where).toEqual({});
  expect((await carregarEscopoLeituraBpm(7, true)).where).toEqual({});
  expect(m.pipeline).not.toHaveBeenCalled();
});
it("todos iniciam com próprios e livres e qualquer usuário pode consultar todos", () => {
  const entradas = [7, 9, 14, null].map((uid, i) => ({ id: `c${i}`, etapaId: "e", revision: "1", nome: "Empresa", cnpj: null, servico: null, responsaveis: uid ? [{ id: uid, nome: "Pessoa" }] : [] }));
  const acesso = { userId: 7, admin: false, setores: [{ id: 3, nome: "Comercial", usuarioIds: [9] }], responsaveis: [{ id: 9, nome: "Ana" }] };
  expect(selecionarPaginaQuadro(entradas, { acesso }).ids).toEqual(["c0", "c3"]);
  expect(selecionarPaginaQuadro(entradas, { acesso, visao: "TODOS" }).ids).toHaveLength(4);
  expect(selecionarPaginaQuadro(entradas, { acesso, visao: "TODOS", responsavelId: 9 }).ids).toEqual(["c1"]);
});
