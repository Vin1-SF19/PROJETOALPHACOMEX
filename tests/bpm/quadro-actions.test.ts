import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), pipeline: vi.fn(), usuario: vi.fn(), cards: vi.fn(), resumos: vi.fn(), leads: vi.fn(), instagram: vi.fn(), setores: vi.fn(), usuarios: vi.fn(), permissoes: vi.fn(), overrides: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("@/lib/bpm/ownership", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/bpm/ownership")>(), exigirAcessoBpmPipeline: m.acesso }));
vi.mock("@/lib/prisma", () => ({ default: { bpmPipeline: { findUnique: m.pipeline }, usuarios: { findUnique: m.usuario, findMany: m.usuarios }, setor: { findMany: m.setores }, setorPermissao: { findMany: m.permissoes }, usuarioPermissaoOverride: { findMany: m.overrides }, bpmCard: { findMany: m.cards } } }));
vi.mock("@/actions/bpm/Cards", () => ({ ListarCardsPipelineBpm: m.resumos }));
vi.mock("@/lib/bpm/noloss-leads", () => ({ buscarNolossLeadsPendentes: m.leads }));
vi.mock("@/lib/bpm/instagram-leads-server", () => ({ buscarInstagramLeadsPendentes: m.instagram }));
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";
import { origensDisponiveisQuadro } from "@/lib/bpm/origem-quadro";
const card = { id: "c1", etapaId: "stage", createdAt: new Date("2026-10-14"), updatedAt: new Date("2026-10-14"), servico: "Radar", status: "ATIVO", empresa: { razaoSocial: "Empresa", nomeFantasia: null, cnpj: null }, responsavel: { id: 7, nome: "Responsável" }, membros: [], vinculosOrigem: [] };
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "7" } }); m.acesso.mockResolvedValue(undefined);
  m.usuario.mockResolvedValue({ role: "Comercial" }); m.pipeline.mockResolvedValue({ nome: "Revisão de Radar", configVersion: 1, setores: [{ setor: { id: 3, nome: "Comercial" } }], etapas: [{ id: "stage", nome: "Novo Lead", ehFinal: false, visibilidades: [], automacoes: [] }] });
  m.setores.mockResolvedValue([{ id: 3, nome: "Comercial" }]); m.usuarios.mockResolvedValue([{ id: 9, nome: "Equipe", role: "Comercial", status: "ATIVO", permissoes: "crm" }, { id: 7, nome: "Responsável", role: "Comercial", status: "ATIVO", permissoes: "crm" }]); m.permissoes.mockResolvedValue([]); m.overrides.mockResolvedValue([]);
  m.cards.mockResolvedValue([card]); m.leads.mockResolvedValue([]); m.instagram.mockResolvedValue([]); m.resumos.mockResolvedValue({ success: true, data: [{ id: "c1" }] });
});
describe("sincronização do quadro", () => {
  it("ordena cards e NoLoss juntos antes da página e mantém o novo lead no topo no polling", async () => {
    m.cards.mockResolvedValue(Array.from({ length: 35 }, (_, i) => ({ ...card, id: `real-${i}`, createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)) })));
    const leads = [
      { id: "noloss-antigo", nome: "Antigo", receivedAt: new Date("2026-09-01") },
      { id: "noloss-novo", nome: "Recente", receivedAt: new Date("2026-10-21") },
    ];
    m.leads.mockResolvedValue(leads);
    m.resumos.mockImplementation(async (_pipeline, ids: string[]) => ({ success: true, data: ids.map((id) => ({ id })) }));
    const primeira = await SincronizarQuadroBpm("pipeline");
    if (!primeira.success) throw new Error("fixture");
    expect(primeira.ids[0]).toBe("noloss-novo");
    expect(primeira.ids.slice(1)).toEqual(Array.from({ length: 29 }, (_, i) => `real-${34 - i}`));
    expect(primeira.manifesto.entradas.at(-1)?.id).toBe("noloss-antigo");
    expect(primeira.manifesto.entradas[0].createdAt).toBe("2026-10-21T00:00:00.000Z");
    m.leads.mockResolvedValue([...leads, { id: "ainda-mais-novo", nome: "Chegou agora", receivedAt: new Date("2026-10-22") }]);
    const poll = await SincronizarQuadroBpm("pipeline", { conhecidos: primeira.manifesto.entradas.filter((item) => primeira.ids.includes(item.id)) });
    expect(poll).toMatchObject({ success: true });
    if (!poll.success) throw new Error("fixture");
    expect(poll.ids[0]).toBe("ainda-mais-novo");
    expect(poll.cards).toEqual([{ id: "ainda-mais-novo" }]);
    const todas = await SincronizarQuadroBpm("pipeline", { limites: { stage: 60 } });
    expect(todas).toMatchObject({ success: true });
    if (!todas.success) throw new Error("fixture");
    expect(todas.ids).toHaveLength(38); expect(new Set(todas.ids).size).toBe(38);
    expect(todas.ids.at(-1)).toBe("noloss-antigo");
  });
  it("nega pipeline revogado antes de consultar cards", async () => {
    m.acesso.mockRejectedValue(new Error("Não autorizado"));
    expect(await SincronizarQuadroBpm("pipeline")).toMatchObject({ success: false, acessoNegado: true }); expect(m.cards).not.toHaveBeenCalled(); expect(m.leads).not.toHaveBeenCalled();
  });
  it("preserva guardas de pipeline e coluna e revalida resumos na hidratação", async () => {
    const r = await SincronizarQuadroBpm("pipeline"); expect(r.success).toBe(true);
    expect(m.cards).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ pipelineId: "pipeline", etapaId: { in: ["stage"] } }) }));
    expect(m.resumos).toHaveBeenCalledWith("pipeline", ["c1"]);
  });
  it("poll sem mudanças não busca resumos; invalidação força relações", async () => {
    const first = await SincronizarQuadroBpm("pipeline"); if (!first.success) throw new Error("fixture");
    const conhecidos = first.manifesto.entradas.map(({ id, revision }) => ({ id, revision })); m.resumos.mockClear();
    const poll = await SincronizarQuadroBpm("pipeline", { conhecidos }); expect(poll.success).toBe(true); expect(m.resumos).not.toHaveBeenCalled();
    await SincronizarQuadroBpm("pipeline", { conhecidos, forcar: true }); expect(m.resumos).toHaveBeenCalledOnce();
  });
  it("lead sem vínculo é compartilhado apenas dentro do pipeline acessível", async () => {
    m.leads.mockResolvedValue([{ id: "noloss", nome: "Lead livre" }]);
    m.resumos.mockResolvedValue({ success: true, data: [{ id: "c1" }, { id: "noloss" }] });
    const r = await SincronizarQuadroBpm("pipeline"); if (!r.success) throw new Error("fixture");
    expect(r.manifesto.entradas.find((e) => e.id === "noloss")?.responsaveis).toEqual([]);
  });
  it("não conserva card revogado durante a hidratação", async () => {
    m.resumos.mockResolvedValue({ success: true, data: [] }); const r = await SincronizarQuadroBpm("pipeline");
    expect(r).toMatchObject({ success: true, ids: [], manifesto: { entradas: [] } });
  });
  it("limita entrada maliciosa e não consulta banco sem sessão", async () => {
    expect(await SincronizarQuadroBpm("pipeline", { limites: { stage: 100000 } })).toMatchObject({ success: false });
    m.auth.mockResolvedValue(null); expect(await SincronizarQuadroBpm("pipeline")).toMatchObject({ success: false, acessoNegado: true }); expect(m.cards).not.toHaveBeenCalled();
  });
});

it("padrão de admin é meus, mas ele pode selecionar todos", async () => {
  m.usuario.mockResolvedValue({ role: "ADMIN" });
  m.cards.mockResolvedValue([card, { ...card, id: "c2", responsavel: { id: 9, nome: "Equipe" } }]);
  m.resumos.mockImplementation(async (_pipeline, ids: string[]) => ({ success: true, data: ids.map((id) => ({ id })) }));
  const meus = await SincronizarQuadroBpm("pipeline"); expect(meus).toMatchObject({ success: true, ids: ["c1"] });
  const todos = await SincronizarQuadroBpm("pipeline", { visao: "TODOS" }); expect(todos).toMatchObject({ success: true, ids: ["c2", "c1"] });
});
it.each(["Comercial", "TI"])("não aceita pessoa fora do catálogo ou setor inválido, perfil %s", async (role) => {
  m.usuario.mockResolvedValue({ role });
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS", responsavelId: 99 })).toMatchObject({ success: false, visaoRevogada: true });
  expect(await SincronizarQuadroBpm("pipeline", { visao: "SETOR", setorId: 99 })).toMatchObject({ success: false, visaoRevogada: true });
  expect(m.cards).not.toHaveBeenCalled();
});
it("usuário comum seleciona colegas sem cards e todos inclui responsáveis legados", async () => {
  m.cards.mockResolvedValue([card, { ...card, id: "c2", responsavel: { id: 9, nome: "Equipe" } }, { ...card, id: "ti", responsavel: { id: 99, nome: "TI legado" } }]);
  m.usuarios.mockResolvedValue([{ id: 9, nome: "Equipe", role: "Comercial", status: "ATIVO", permissoes: "crm" }, { id: 10, nome: "Sem cards", role: "Comercial", status: "ATIVO", permissoes: "crm" }, { id: 99, nome: "TI legado", role: "TI", status: "ATIVO", permissoes: null }]);
  m.resumos.mockImplementation(async (_pipeline, ids: string[]) => ({ success: true, data: ids.map((id) => ({ id })) }));
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS" })).toMatchObject({ success: true, ids: ["ti", "c2", "c1"], manifesto: { acesso: { responsaveis: [{ id: 9, nome: "Equipe" }, { id: 10, nome: "Sem cards" }] } } });
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS", responsavelId: 9 })).toMatchObject({ success: true, ids: ["c2"] });
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS", responsavelId: 10 })).toMatchObject({ success: true, ids: [] });
  m.overrides.mockResolvedValue([{ usuarioId: 9, modulo: "crm", acao: "REMOVE" }]);
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS", responsavelId: 9 })).toMatchObject({ success: false, visaoRevogada: true });
});
it("oculta colunas sem permissão também em Todos", async () => {
  const pipeline = await m.pipeline();
  m.pipeline.mockResolvedValue({ ...pipeline, etapas: [{ ...pipeline.etapas[0], visibilidades: [{ perfil: "Comercial", podeVer: false, podeAgir: false }] }] });
  await SincronizarQuadroBpm("pipeline", { visao: "TODOS" });
  expect(m.cards).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ pipelineId: "pipeline", etapaId: { in: [] } }) }));
});

it.each([
  { userId: 7, role: "Lider Comercial", setor: "Comercial" },
  { userId: 10, role: "OPERACIONAL", setor: "Operacional" },
])("permite ao líder $role consultar cards de colegas no setor liderado", async ({ userId, role, setor }) => {
  m.auth.mockResolvedValue({ user: { id: String(userId) } });
  m.usuario.mockResolvedValue({ role });
  const pipeline = await m.pipeline();
  m.pipeline.mockResolvedValue({ ...pipeline, setores: [{ setor: { nome: setor, ativo: true } }] });
  m.cards.mockResolvedValue([{ ...card, responsavel: { id: 99, nome: "Colega" } }]);
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS" })).toMatchObject({ success: true, ids: ["c1"] });
  expect(m.cards.mock.calls[0][0].where.AND).toBeUndefined();
});
it("não concede autoridade administrativa ao líder de outro setor", async () => {
  m.usuario.mockResolvedValue({ role: "Lider Comercial" });
  const pipeline = await m.pipeline();
  m.pipeline.mockResolvedValue({ ...pipeline, setores: [{ setor: { nome: "Operacional", ativo: true } }] });
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS" })).toMatchObject({ success: true, manifesto: { acesso: { admin: false } } });
});

describe("origem no manifesto autorizado", () => {
  const campoOrigem = (valor: string) => ({ valor, campo: { nome: "Origem do cliente", chave: null, ativo: true } });

  it("filtra a origem de um card fora do primeiro lote e preserva as facetas completas", async () => {
    m.cards.mockResolvedValue(Array.from({ length: 381 }, (_, i) => ({ ...card, id: `origem-${i}`, empresaId: 1,
      createdAt: new Date(Date.UTC(2026, 8, 1, 0, 381 - i)), campoValores: [campoOrigem(i === 380 ? "Callix" : "Instagram")] })));
    m.resumos.mockImplementation(async (_pipeline, ids: string[]) => ({ success: true, data: ids.map((id) => ({ id })) }));
    const r = await SincronizarQuadroBpm("pipeline", { origem: "Callix", busca: "empresa", responsavelId: 7 });
    if (!r.success) throw new Error("fixture");
    expect(r.ids).toEqual(["origem-380"]);
    expect(origensDisponiveisQuadro(r.manifesto.entradas)).toEqual(["Callix", "Instagram"]);
    expect(r.manifesto.entradas).toHaveLength(381);
    expect(m.resumos).toHaveBeenCalledExactlyOnceWith("pipeline", ["origem-380"]);
    expect(m.cards).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ pipelineId: "pipeline", etapaId: { in: ["stage"] } }) }));
  });

  it("distingue origem ausente, null e string e valida entrada antes do banco", async () => {
    m.cards.mockResolvedValue([{ ...card, id: "com-origem", empresaId: 1, campoValores: [campoOrigem("Instagram")] }, { ...card, id: "sem-origem", empresaId: 1 }]);
    m.resumos.mockImplementation(async (_pipeline, ids: string[]) => ({ success: true, data: ids.map((id) => ({ id })) }));
    expect(await SincronizarQuadroBpm("pipeline")).toMatchObject({ success: true, ids: ["sem-origem", "com-origem"] });
    expect(await SincronizarQuadroBpm("pipeline", { origem: null })).toMatchObject({ success: true, ids: ["sem-origem"] });
    expect(await SincronizarQuadroBpm("pipeline", { origem: "Instagram" })).toMatchObject({ success: true, ids: ["com-origem"] });
    m.cards.mockClear();
    expect(await SincronizarQuadroBpm("pipeline", { origem: { canal: "Instagram" } })).toMatchObject({ success: false });
    expect(await SincronizarQuadroBpm("pipeline", { origem: "x".repeat(201) })).toMatchObject({ success: false });
    expect(m.cards).not.toHaveBeenCalled();
  });

  it("projeta Instagram, NoLoss e origem contextual sem inventar canal a partir do provedor RD", async () => {
    m.cards.mockResolvedValue([
      { ...card, id: "contexto", empresaId: 7, servicoContexto: { clienteServico: { clienteId: 7, origemLead: "Evento", canalAquisicao: null } } },
      { ...card, id: "rd-sem-canal", empresaId: 7, origemExterna: { provider: "RD_STATION_CRM_V1" } },
    ]);
    m.leads.mockResolvedValue([{ id: "site", nome: "Lead do site", utmSource: "website", receivedAt: new Date("2026-10-23") }, { id: "sem-utm", nome: "NoLoss sem UTM", receivedAt: new Date("2026-10-23") }]);
    m.instagram.mockResolvedValue([{ id: "ig", recebidoEm: new Date("2026-10-23"), dados: { nome: "Lead Instagram", cnpj: null } }]);
    m.resumos.mockImplementation(async (_pipeline, ids: string[]) => ({ success: true, data: ids.map((id) => ({ id })) }));
    const r = await SincronizarQuadroBpm("pipeline", { visao: "TODOS" });
    if (!r.success) throw new Error("fixture");
    expect(Object.fromEntries(r.manifesto.entradas.map((e) => [e.id, e.origem]))).toEqual({ contexto: "Evento", "rd-sem-canal": null, site: "Site", "sem-utm": "NoLoss", ig: "Instagram" });
    expect(m.cards).toHaveBeenCalledOnce();
    expect(m.cards.mock.calls[0][0].select.servicoContexto.select).toEqual({ clienteServico: { select: { clienteId: true, origemLead: true, canalAquisicao: true } }, contratoComercial: { select: { clienteId: true, canalAquisicao: true } } });
  });

  it("altera revision e reidrata resumo quando a origem muda sem atualizar a data do card", async () => {
    m.cards.mockResolvedValue([{ ...card, empresaId: 7, campoValores: [campoOrigem("Instagram")] }]);
    const first = await SincronizarQuadroBpm("pipeline");
    if (!first.success) throw new Error("fixture");
    const conhecidos = first.manifesto.entradas.map(({ id, revision }) => ({ id, revision }));
    m.cards.mockResolvedValue([{ ...card, empresaId: 7, campoValores: [campoOrigem("Callix")] }]);
    m.resumos.mockClear();
    const next = await SincronizarQuadroBpm("pipeline", { conhecidos, origem: "Callix" });
    if (!next.success) throw new Error("fixture");
    expect(next.manifesto.entradas[0].revision).not.toBe(first.manifesto.entradas[0].revision);
    expect(next.manifesto.entradas[0].origem).toBe("Callix");
    expect(m.resumos).toHaveBeenCalledExactlyOnceWith("pipeline", ["c1"]);
  });

  it("remove também a opção da origem de um card revogado durante hidratação", async () => {
    m.cards.mockResolvedValue([{ ...card, empresaId: 7, campoValores: [campoOrigem("Canal exclusivo")] }]);
    m.resumos.mockResolvedValue({ success: true, data: [] });
    const r = await SincronizarQuadroBpm("pipeline", { origem: "Canal exclusivo" });
    if (!r.success) throw new Error("fixture");
    expect(r.manifesto.entradas).toEqual([]);
    expect(origensDisponiveisQuadro(r.manifesto.entradas)).toEqual([]);
  });
});
