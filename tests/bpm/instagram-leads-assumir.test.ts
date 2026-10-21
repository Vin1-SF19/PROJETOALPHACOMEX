import { beforeEach, describe, expect, it, vi } from "vitest";
import { INSTAGRAM_COLUNAS as C, prepararLeadInstagram } from "@/lib/bpm/instagram-leads";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), endpoint: vi.fn(), etapa: vi.fn(), acesso: vi.fn(), acessoCard: vi.fn(), elegivel: vi.fn(), snapshots: vi.fn(), transicao: vi.fn(),
  evento: vi.fn(), fila: vi.fn(), sla: vi.fn(), cadencias: vi.fn(), imediatas: vi.fn(), notificar: vi.fn(), transaction: vi.fn(),
  tx: {
    bpmWebhookEntrada: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    bpmEtapa: { findFirst: vi.fn() }, usuarios: { findUnique: vi.fn() }, bpmCampo: { findMany: vi.fn() },
    cliente: { findUnique: vi.fn(), create: vi.fn() }, pessoa: { upsert: vi.fn(), create: vi.fn() }, pessoaClienteVinculo: { upsert: vi.fn() },
    bpmCard: { create: vi.fn() }, bpmCardMembro: { create: vi.fn() }, bpmCardCampoValor: { create: vi.fn(), upsert: vi.fn() },
    bpmInteracaoCard: { create: vi.fn() }, bpmCardHistorico: { create: vi.fn() },
  },
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
// Nenhum delegate de mutação fora da transação está disponível neste mock.
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction } }));
vi.mock("@/lib/bpm/instagram-leads-server", () => ({ carregarEndpointInstagram: mocks.endpoint, etapaEntradaInstagram: mocks.etapa }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmPipeline: mocks.acesso, exigirAcessoBpmCard: mocks.acessoCard, usuarioElegivelResponsavelBpm: mocks.elegivel }));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarSnapshotsCopiaCamposCard: mocks.snapshots, verificarTransicaoPermitidaBpm: mocks.transicao }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: mocks.evento }));
vi.mock("@/lib/bpm/automacoes/fila", () => ({ enfileirarAutomacoesCriacaoCardBpm: mocks.fila }));
vi.mock("@/lib/bpm/sla", () => ({ criarSlaInstancia: mocks.sla }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: mocks.cadencias }));
vi.mock("@/lib/bpm/cadencias/executor", () => ({ processarCadenciasImediatasDoCardBpm: mocks.imediatas }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notificar }));
import { AssumirLeadInstagram } from "@/actions/bpm/InstagramLeads";

const input = { leadId: "clw0000000000000lead", etapaDestinoId: "clw0000000000000etap", responsavelId: 7 };
const dados = prepararLeadInstagram({ id: "l:example", full_name: "Contato Exemplo", email: "contato@example.com", created_time: "2026-10-21T12:00:00Z",
  [C.cnpj]: "11.222.333/0001-81", [C.telefone]: "(11) 99999-0000", [C.radar]: "ilimitado", [C.volume]: "até_150_mil_dólares", [C.prazo]: "preciso_para_ontem", campaign_name: "Campanha exemplo" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
  mocks.endpoint.mockResolvedValue({ id: "endpoint", pipelineId: "pipeline" });
  mocks.etapa.mockResolvedValue({ id: input.etapaDestinoId, nome: "Novo Lead", visibilidades: [] });
  mocks.tx.bpmEtapa.findFirst.mockResolvedValue({ id: input.etapaDestinoId, nome: "Novo Lead", visibilidades: [] });
  mocks.tx.usuarios.findUnique.mockResolvedValue({ role: "COMERCIAL" });
  mocks.tx.bpmWebhookEntrada.findFirst.mockResolvedValue({ id: input.leadId, statusRecebimento: "AUTENTICADO", payloadSanitizadoJson: JSON.stringify(dados), evento: null });
  mocks.tx.bpmWebhookEntrada.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.bpmCampo.findMany.mockResolvedValue([
    { id: "radar", nome: "Radar pretendido", tipo: "selecao", opcoesJson: null, opcoes: [{ rotulo: "Revisão de Radar Ilimitado" }] },
    { id: "canal", nome: "Canal de origem", tipo: "texto", opcoesJson: null, opcoes: [] },
  ]);
  mocks.elegivel.mockResolvedValue(true); mocks.acesso.mockResolvedValue(undefined); mocks.acessoCard.mockResolvedValue(undefined);
  mocks.transicao.mockResolvedValue({ permitida: true }); mocks.snapshots.mockResolvedValue({}); mocks.evento.mockResolvedValue({ id: "evento" });
  mocks.tx.cliente.findUnique.mockResolvedValue({ id: 12 }); mocks.tx.pessoa.upsert.mockResolvedValue({ id: 23 }); mocks.tx.pessoa.create.mockResolvedValue({ id: 24 });
  mocks.tx.bpmCard.create.mockResolvedValue({ id: "card", createdAt: new Date("2026-10-21T13:00:00Z") });
  mocks.tx.bpmCardMembro.create.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
});

describe("assunção Instagram", () => {
  it("preserva contato/Qs, usa CNPJ existente e cria todos efeitos na mesma transação", async () => {
    expect(await AssumirLeadInstagram(input)).toEqual({ success: true, data: { cardId: "card" } });
    expect(mocks.tx.cliente.findUnique).toHaveBeenCalledWith({ where: { cnpj: "11222333000181" }, select: { id: true } });
    expect(mocks.tx.cliente.create).not.toHaveBeenCalled();
    expect(mocks.tx.pessoa.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { celular: "11999990000" }, update: {}, create: expect.objectContaining({ nome: dados.nome, email: dados.email }) }));
    expect(mocks.tx.pessoaClienteVinculo.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { ativo: true } }));
    expect(mocks.tx.bpmInteracaoCard.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ observacoes: expect.stringContaining("Campanha exemplo") }) }));
    expect(mocks.tx.bpmInteracaoCard.create.mock.calls[0][0].data.observacoes).toContain("até 150 mil dólares");
    expect(mocks.tx.bpmWebhookEntrada.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ statusRecebimento: "AUTENTICADO", eventoId: null }), data: { statusRecebimento: "PROCESSADO" } }));
    expect(mocks.tx.bpmWebhookEntrada.update).toHaveBeenCalledWith({ where: { id: input.leadId }, data: { eventoId: "evento" } });
    expect(mocks.tx.bpmCardMembro.create).toHaveBeenCalled();
    expect(mocks.sla).toHaveBeenCalledTimes(2); expect(mocks.cadencias).toHaveBeenCalledWith(expect.anything(), mocks.tx);
    expect(mocks.fila).toHaveBeenCalledWith(expect.anything(), mocks.tx);
  });
  it("CAS perdedora não cria empresa, contato, card ou automação", async () => {
    mocks.tx.bpmWebhookEntrada.updateMany.mockResolvedValue({ count: 0 });
    expect(await AssumirLeadInstagram(input)).toMatchObject({ success: false });
    expect(mocks.tx.cliente.findUnique).not.toHaveBeenCalled(); expect(mocks.tx.bpmCard.create).not.toHaveBeenCalled(); expect(mocks.fila).not.toHaveBeenCalled();
  });
  it("falha dentro da transação não dispara notificação nem cadência externa", async () => {
    mocks.tx.bpmCardMembro.create.mockRejectedValueOnce(new Error("falha de armazenamento"));
    expect(await AssumirLeadInstagram(input)).toMatchObject({ success: false });
    expect(mocks.notificar).not.toHaveBeenCalled(); expect(mocks.imediatas).not.toHaveBeenCalled();
    expect(mocks.tx.bpmWebhookEntrada.update).not.toHaveBeenCalled();
  });
  it("reenvio de assunção resolve card com ACL e não repete efeitos", async () => {
    mocks.tx.bpmWebhookEntrada.findFirst.mockResolvedValue({ id: input.leadId, statusRecebimento: "PROCESSADO", evento: { cardId: "card-existente" } });
    expect(await AssumirLeadInstagram(input)).toEqual({ success: true, data: { cardId: "card-existente" } });
    expect(mocks.acessoCard).toHaveBeenCalledWith("card-existente", 7, "COMERCIAL", "visualizar");
    expect(mocks.tx.bpmCard.create).not.toHaveBeenCalled(); expect(mocks.imediatas).not.toHaveBeenCalled();
  });
  it("sem permissão, sem sessão ou responsável inelegível não reserva entrada", async () => {
    mocks.acesso.mockRejectedValueOnce(new Error("Não autorizado"));
    expect(await AssumirLeadInstagram(input)).toMatchObject({ success: false });
    mocks.elegivel.mockResolvedValue(false);
    expect(await AssumirLeadInstagram(input)).toMatchObject({ success: false });
    mocks.auth.mockResolvedValue(null);
    expect(await AssumirLeadInstagram(input)).toMatchObject({ success: false });
    expect(mocks.tx.bpmWebhookEntrada.updateMany).not.toHaveBeenCalled();
  });
  it("CNPJ ou Radar sem correspondência exige revisão antes de criar", async () => {
    const pendente = prepararLeadInstagram({ ...dados.linha, [C.cnpj]: "inválido", [C.radar]: "em_constituição" });
    mocks.tx.bpmWebhookEntrada.findFirst.mockResolvedValue({ id: input.leadId, statusRecebimento: "AUTENTICADO", payloadSanitizadoJson: JSON.stringify(pendente) });
    expect(await AssumirLeadInstagram({ ...input, cnpj: "123" })).toMatchObject({ success: false, error: expect.stringContaining("CNPJ") });
    expect(await AssumirLeadInstagram({ ...input, cnpj: "11222333000181" })).toMatchObject({ success: false, error: expect.stringContaining("Radar") });
    expect(mocks.tx.bpmCard.create).not.toHaveBeenCalled();
  });
  it("sem CNPJ cria empresa provisória sem buscar outra por nome ou documento fictício", async () => {
    mocks.tx.cliente.create.mockResolvedValue({ id: 13 });
    expect(await AssumirLeadInstagram({ ...input, cnpj: "" })).toEqual({ success: true, data: { cardId: "card" } });
    expect(mocks.tx.cliente.findUnique).not.toHaveBeenCalled();
    expect(mocks.tx.cliente.create).toHaveBeenCalledWith({ data: { cnpj: null, razaoSocial: dados.nome, status: "ATIVO" }, select: { id: true } });
  });
});
