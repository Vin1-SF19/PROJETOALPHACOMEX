import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ db: {}, auth: vi.fn(), trigger: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: state.db }));
vi.mock("../../auth", () => ({ auth: state.auth }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: state.trigger } }));

import { GET } from "@/app/api/bpm/leads/alertas/route";
import { listarDestinatariosFilaLeadsBpm, lerCursorAlertasLeadsBpm,
  listarAlertasLeadsBpm, notificarPendenciasLeadsBpm, obterAlertaLeadPendenteBpm,
} from "@/lib/bpm/notificacoes-leads-server";
import { ACAO_RECEPCAO_PIPELINE, ACAO_ASSUNCAO_PIPELINE, carregarRecepcoesPipelineBpm,
  idRecepcaoPipeline, idAssuncaoPipeline, obterRecebimentoPipelineBpm,
} from "@/lib/bpm/recebimentos-card-server";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";

const cardId = "c111111111111111111111111";
const sourceId = "c222222222222222222222222";
const pipelineId = "c333333333333333333333333";
const sourcePipelineId = "c444444444444444444444444";
const stageId = "c555555555555555555555555";
const executionId = "c666666666666666666666666";
const cursor = (usuarioId: number, fonte = "ENCAMINHAMENTO", id = "") => Buffer.from(JSON.stringify({
  versao: 1, usuarioId, fonte, id, snapshotEm: "2026-10-22T14:00:00.000Z",
})).toString("base64url");

function fixture() {
  const users = [
    { id: 21, nome: "Financeiro Fictício", role: "Financeiro", status: "ATIVO", permissoes: "crm", imagemUrl: null },
    { id: 22, nome: "Liderança Fictícia", role: "Líder Financeiro", status: "ATIVO", permissoes: "crm", imagemUrl: null },
    { id: 23, nome: "Conta Inativa", role: "Financeiro", status: "INATIVO", permissoes: "crm", imagemUrl: null },
    ...["Admin", "CEO", "TI", "Comercial", "Operacional"].map((role, i) => ({
      id: 30 + i, nome: `Outro ${role}`, role, status: "ATIVO", permissoes: "crm", imagemUrl: null,
    })),
  ];
  const overrides: { usuarioId: number; modulo: string; acao: string }[] = [];
  const setorPermissoes: { setor: string; modulo: string }[] = [];
  const rules = [
    { perfil: "Financeiro", podeVer: true, podeAgir: false },
    { perfil: "Lider Financeiro", podeVer: true, podeAgir: true },
  ];
  const pipeline = { id: pipelineId, chave: "financeiro", nome: "Financeiro", ativo: true,
    visualizacaoConfigJson: null as string | null, setores: [{ setor: { nome: "Financeiro", ativo: true } }],
    etapas: [{ visibilidades: rules }] };
  const marker = { versao: 1, cardDestinoId: cardId, pipelineDestinoId: pipelineId,
    cardOrigemId: sourceId, pipelineOrigemId: sourcePipelineId, execucaoId: executionId,
    responsaveisAnteriores: [{ pipelineId: sourcePipelineId, pipelineNome: "Comercial", setor: "COMERCIAL",
      usuarioId: 11, nome: "Closer Fictício" }] };
  const receipt = { id: idRecepcaoPipeline(cardId), cardId, acao: ACAO_RECEPCAO_PIPELINE,
    createdAt: new Date("2026-10-22T12:00:00Z"), valorNovoJson: JSON.stringify(marker), usuarioId: null as number | null };
  const histories = [receipt];
  const card = { id: cardId, empresaId: 7, pipelineId, etapaId: stageId, status: "ATIVO", versao: 4,
    updatedAt: new Date("2026-10-22T12:05:00Z"), responsavelId: 11, servico: "Revisão Radar",
    pipeline, etapa: { ativo: true, nome: "Novo contrato" }, empresa: { razaoSocial: "Empresa Fictícia", cnpj: null } };
  const cards = [card];
  const links = [{ cardOrigemId: sourceId, cardDestinoId: cardId,
    cardOrigem: { empresaId: 7, pipelineId: sourcePipelineId } }];
  const executions = [{ id: executionId, cardId: sourceId }];
  const events = [{ tipo: "CARD_CRIADO", cardId, pipelineId, atorExecucaoId: executionId,
    valorNovoJson: JSON.stringify({ cardOrigemId: sourceId }) }];
  const noloss = { id: "noloss-fixture", nome: "Contato Fictício", email: null, telefone: null,
    utmSource: null as string | null, receivedAt: new Date("2026-10-22T11:00:00Z") };
  const write = () => vi.fn(() => { throw new Error("Leitura tentou modificar dados"); });
  const io = {
    usuarios: { findMany: vi.fn(async () => users), findUnique: vi.fn(async ({ where }: { where: { id: number } }) => users.find((u) => u.id === where.id) ?? null) },
    setorPermissao: { findMany: vi.fn(async () => setorPermissoes) },
    usuarioPermissaoOverride: { findMany: vi.fn(async () => overrides) },
    bpmPipeline: { findUnique: vi.fn(async () => pipeline), findFirst: vi.fn(async () => ({ id: pipelineId, nome: "Revisão de Radar", etapas: [{ id: stageId, nome: "Novo lead" }] })) },
    bpmCard: { findMany: vi.fn(async () => cards), findUnique: vi.fn(async () => ({ ...card,
      responsavel: { id: card.responsavelId, nome: "Responsável Técnico Atual", cpf: null },
      empresa: { ...card.empresa, pessoas: [] }, indicacaoOrigem: null,
    })), create: write(), updateMany: write(), delete: write() },
    bpmCampo: { findMany: vi.fn(async (): Promise<{ id: string }[]> => [{ id: "vendedor" }]) },
    bpmCardHistorico: { findMany: vi.fn(async ({ where }: { where: { id?: { in?: string[] }; acao?: string } }) =>
      histories.filter((h) => (!where.id?.in || where.id.in.includes(h.id)) && (!where.acao || h.acao === where.acao))), create: write() },
    bpmCardVinculo: { findMany: vi.fn(async () => links), create: write() },
    bpmAutomacaoExecucao: { findMany: vi.fn(async () => executions), create: write(), updateMany: write() },
    bpmEventoDominio: { findMany: vi.fn(async () => events), create: write() },
    bpmCardMembro: { updateMany: write(), upsert: write() },
    bpmWebhookEntrada: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), updateMany: write() },
    bpmWebhookEndpoint: { findUnique: vi.fn().mockResolvedValue(null) },
    nolossLead: { findMany: vi.fn(async () => [noloss]), findFirst: vi.fn(async () => noloss), updateMany: write() },
    $transaction: write(), $executeRaw: write(),
  };
  const client = io as unknown as Prisma.TransactionClient;
  const read = () => carregarRecepcoesPipelineBpm([receipt.id], client);
  const writeSpies = [io.bpmCard.create, io.bpmCard.updateMany, io.bpmCard.delete, io.bpmCardHistorico.create,
    io.bpmCardVinculo.create, io.bpmAutomacaoExecucao.create, io.bpmAutomacaoExecucao.updateMany,
    io.bpmEventoDominio.create, io.bpmCardMembro.updateMany, io.bpmCardMembro.upsert,
    io.bpmWebhookEntrada.updateMany, io.nolossLead.updateMany, io.$transaction, io.$executeRaw];
  Object.assign(state.db, io);
  return { users, overrides, setorPermissoes, rules, pipeline, marker, receipt, histories, card, cards, links,
    executions, events, noloss, io, client, read, writeSpies };
}

beforeEach(() => { vi.clearAllMocks(); state.auth.mockResolvedValue({ user: { id: "21", role: "Financeiro" } }); state.trigger.mockResolvedValue(undefined); });

describe("audiência independente usa ownership e visibilidade reais", () => {
  it("inclui visualizador e liderança do setor, sem inscrever bypass administrativo ou outros setores", async () => {
    const f = fixture();
    expect(await listarDestinatariosFilaLeadsBpm(pipelineId, stageId, f.client)).toEqual([
      expect.objectContaining({ id: 21, podeAgir: false }), expect.objectContaining({ id: 22, podeAgir: true }),
    ]);
    expect(f.io.usuarios.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ATIVO" } }));
  });
  it("REMOVE individual de CRM prevalece mesmo em integrante com permissão legada", async () => {
    const f = fixture(); f.overrides.push({ usuarioId: 21, modulo: "crm", acao: "REMOVE" });
    expect((await listarDestinatariosFilaLeadsBpm(pipelineId, stageId, f.client)).map((u) => u.id)).toEqual([22]);
  });
  it("ADD individual concede módulo somente ao próprio setor, não a outro setor", async () => {
    const f = fixture(); f.users[0].permissoes = "";
    f.overrides.push({ usuarioId: 21, modulo: "crm", acao: "ADD" });
    expect((await listarDestinatariosFilaLeadsBpm(pipelineId, stageId, f.client)).map((u) => u.id)).toEqual([21, 22]);
  });
  it("catálogo setorial efetivo substitui permissão legada", async () => {
    const f = fixture(); f.setorPermissoes.push({ setor: "Financeiro", modulo: "metas" });
    expect((await listarDestinatariosFilaLeadsBpm(pipelineId, stageId, f.client)).map((u) => u.id)).toEqual([22]);
  });
  it.each(["pipeline-inativo", "etapa-inativa", "podeVer-false", "semCRM", "pipeline-setor-alheio"])("não entrega ao recurso não autorizado: %s", async (caso) => {
    const f = fixture();
    if (caso === "pipeline-inativo") f.pipeline.ativo = false;
    if (caso === "etapa-inativa") f.pipeline.etapas = [];
    if (caso === "podeVer-false") f.rules.forEach((r) => { r.podeVer = false; });
    if (caso === "semCRM") f.users.forEach((u) => { u.permissoes = "metas"; });
    if (caso === "pipeline-setor-alheio") f.pipeline.setores = [{ setor: { nome: "Jurídico", ativo: true } }];
    expect(await listarDestinatariosFilaLeadsBpm(pipelineId, stageId, f.client)).toEqual([]);
  });
  it("exceção individual de pipeline não inscreve Admin fora do setor", async () => {
    const f = fixture(); f.pipeline.setores = [{ setor: { nome: "Jurídico", ativo: true } }];
    f.pipeline.visualizacaoConfigJson = JSON.stringify({ version: 1, usuariosAutorizados: [21, 30] });
    expect((await listarDestinatariosFilaLeadsBpm(pipelineId, stageId, f.client)).map((u) => u.id)).toEqual([21]);
  });
  it("Operacional recebe inclusive Boas-vindas sem ganhar autorização de assumir", async () => {
    const f = fixture(); f.pipeline.chave = "operacional"; f.pipeline.nome = "Operacional";
    f.pipeline.setores = [{ setor: { nome: "Operacional", ativo: true } }];
    f.card.etapa.nome = "Boas-vindas";
    f.rules.splice(0, f.rules.length, { perfil: "Operacional", podeVer: true, podeAgir: true });
    expect((await listarDestinatariosFilaLeadsBpm(pipelineId, stageId, f.client)).map((u) => u.id)).toEqual([34]);
    expect(await obterRecebimentoPipelineBpm(cardId, 34, f.client)).toMatchObject({ status: "PENDENTE", podeAssumir: false,
      motivoImpedimentoAssuncao: expect.any(String) });
  });
  it.each([
    ["comercial", "Comercial", "Comercial", "Líder Comercial"],
    ["financeiro", "Financeiro", "Financeiro", "Lider Financeiro"],
    ["operacional", "Operacional", "Operacional", "Líder Operacional"],
  ])("famílias reais %s incluem liderança sem converter Admin global em membro", async (chave, nome, role, lider) => {
    const f = fixture(); f.pipeline.chave = chave; f.pipeline.nome = nome;
    f.pipeline.setores = [{ setor: { nome: role, ativo: true } }];
    f.users.splice(0, f.users.length,
      { id: 71, nome: "Integrante Fictício", role, status: "ATIVO", permissoes: "crm", imagemUrl: null },
      { id: 72, nome: "Liderança Fictícia", role: lider, status: "ATIVO", permissoes: "crm", imagemUrl: null },
      { id: 73, nome: "Admin Fora do Setor", role: "Admin", status: "ATIVO", permissoes: "crm", imagemUrl: null });
    f.rules.splice(0, f.rules.length, { perfil: role, podeVer: true, podeAgir: true }, { perfil: lider, podeVer: true, podeAgir: true });
    expect((await listarDestinatariosFilaLeadsBpm(pipelineId, stageId, f.client)).map((u) => u.id)).toEqual([71, 72]);
  });
  it("Comercial sem capacidade de assumir não entra na audiência virtual do AC1", async () => {
    const f = fixture(); f.pipeline.chave = "comercial"; f.pipeline.nome = "Revisão de Radar";
    f.pipeline.setores = [{ setor: { nome: "Comercial", ativo: true } }];
    f.rules.splice(0, f.rules.length, { perfil: "Comercial", podeVer: true, podeAgir: false });
    expect(await listarDestinatariosFilaLeadsBpm(pipelineId, stageId, f.client)).toEqual([]);
  });
});

describe("prova canônica de recepção rejeita JSON isolado e referências estrangeiras", () => {
  it("aceita cadeia concordante sem escrever e mantém pendência para mero visualizador", async () => {
    const f = fixture();
    expect((await f.read()).get(cardId)?.marker.responsaveisAnteriores).toEqual(f.marker.responsaveisAnteriores);
    expect(await obterRecebimentoPipelineBpm(cardId, 21, f.client)).toMatchObject({ status: "PENDENTE", podeAssumir: false,
      responsaveisAnteriores: [{ nome: "Closer Fictício" }] });
    for (const spy of f.writeSpies) expect(spy).not.toHaveBeenCalled();
  });
  it.each(["json-invalido", "array", "versao", "marker-card", "marker-pipeline", "historico-id", "historico-acao",
    "sem-card", "sem-vinculo", "origem-empresa", "origem-pipeline", "origem-id", "sem-execucao", "execucao-origem",
    "sem-evento", "evento-card", "evento-pipeline", "evento-execucao", "evento-json", "evento-origem", "destino-nao-nativo",
  ])("recusa prova incompleta/adulterada: %s", async (caso) => {
    const f = fixture();
    if (caso === "json-invalido") f.receipt.valorNovoJson = "{bad";
    if (caso === "array") f.receipt.valorNovoJson = "[]";
    if (caso === "versao") f.receipt.valorNovoJson = JSON.stringify({ ...f.marker, versao: 2 });
    if (caso === "marker-card") f.receipt.valorNovoJson = JSON.stringify({ ...f.marker, cardDestinoId: sourceId });
    if (caso === "marker-pipeline") f.receipt.valorNovoJson = JSON.stringify({ ...f.marker, pipelineDestinoId: sourcePipelineId });
    if (caso === "historico-id") f.receipt.id = "json-generico";
    if (caso === "historico-acao") f.receipt.acao = "CARD_ATUALIZADO";
    if (caso === "sem-card") f.cards.length = 0;
    if (caso === "sem-vinculo") f.links.length = 0;
    if (caso === "origem-empresa") f.links[0].cardOrigem.empresaId = 999;
    if (caso === "origem-pipeline") f.links[0].cardOrigem.pipelineId = pipelineId;
    if (caso === "origem-id") f.links[0].cardOrigemId = cardId;
    if (caso === "sem-execucao") f.executions.length = 0;
    if (caso === "execucao-origem") f.executions[0].cardId = cardId;
    if (caso === "sem-evento") f.events.length = 0;
    if (caso === "evento-card") f.events[0].cardId = sourceId;
    if (caso === "evento-pipeline") f.events[0].pipelineId = sourcePipelineId;
    if (caso === "evento-execucao") f.events[0].atorExecucaoId = sourceId;
    if (caso === "evento-json") f.events[0].valorNovoJson = "[]";
    if (caso === "evento-origem") f.events[0].valorNovoJson = JSON.stringify({ cardOrigemId: cardId });
    if (caso === "destino-nao-nativo") f.pipeline.chave = "comercial";
    expect((await f.read()).size).toBe(0);
    for (const spy of f.writeSpies) expect(spy).not.toHaveBeenCalled();
  });
  it("mudar de etapa/versão/responsável técnico não resolve a recepção", async () => {
    const f = fixture(); f.card.etapaId = sourceId; f.card.versao = 17; f.card.responsavelId = 22;
    expect(await obterRecebimentoPipelineBpm(cardId, 21, f.client)).toMatchObject({ status: "PENDENTE", assumidoPor: null });
  });
  it.each(["usuario-divergente", "recepcao-estrangeira", "responsavel-estrangeiro", "pipeline-estrangeiro", "setor-estrangeiro"])("assunção inconsistente não é prova de responsável: %s", async (caso) => {
    const f = fixture();
    const claim = { versao: 1, recepcaoId: f.receipt.id, usuarioId: 22, versaoCard: 4,
      responsavel: { pipelineId, pipelineNome: "Financeiro", setor: "FINANCEIRO", usuarioId: 22, nome: "Financeiro Fictício" } };
    if (caso === "usuario-divergente") claim.usuarioId = 99;
    if (caso === "recepcao-estrangeira") claim.recepcaoId = idRecepcaoPipeline(sourceId);
    if (caso === "responsavel-estrangeiro") claim.responsavel.usuarioId = 99;
    if (caso === "pipeline-estrangeiro") claim.responsavel.pipelineId = sourcePipelineId;
    if (caso === "setor-estrangeiro") claim.responsavel.setor = "COMERCIAL";
    f.histories.push({ id: idAssuncaoPipeline(cardId), cardId, acao: ACAO_ASSUNCAO_PIPELINE,
      createdAt: new Date("2026-10-22T13:00:00Z"), valorNovoJson: JSON.stringify(claim), usuarioId: 22 });
    expect((await f.read()).size).toBe(0);
  });
});

describe("vendedor canônico não se transforma no responsável técnico do próximo setor", () => {
  const campos = [
    { id: "vendedor", escopo: "GLOBAL", fonteEntidade: "CARD", fonteAtributo: "responsavelId" },
    { id: "owner", escopo: "GLOBAL", fonteEntidade: "CARD", fonteAtributo: "responsavelId" },
  ];
  it("catálogo e recepção reais selecionam só o vendedor; demais campos mantêm responsável atual", async () => {
    const f = fixture(); f.card.responsavelId = 21;
    expect(await carregarValoresCanonicosCampos(cardId, campos, f.client)).toEqual({ vendedor: "11", owner: "21" });
    expect(f.io.bpmCampo.findMany).toHaveBeenCalledWith({ where: { id: { in: ["vendedor", "owner"] }, chave: "alpha.vendedor.a" }, select: { id: true } });
    for (const spy of f.writeSpies) expect(spy).not.toHaveBeenCalled();
  });
  it.each(["sem-recepcao", "recepcao-forjada"])("sem contexto comercial comprovado não inventa vendedor Financeiro: %s", async (caso) => {
    const f = fixture(); f.card.responsavelId = 21; f.links.length = 0;
    if (caso === "sem-recepcao") f.histories.length = 0;
    if (caso === "recepcao-forjada") f.receipt.valorNovoJson = JSON.stringify({ ...f.marker, pipelineDestinoId: sourcePipelineId });
    expect(await carregarValoresCanonicosCampos(cardId, campos, f.client)).toEqual({ vendedor: "", owner: "21" });
    for (const spy of f.writeSpies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("consulta e transporte não transferem autoridade nem conteúdo privado", () => {
  it.each([null, "campanha-instagram", "google", ""])('NoLoss origem %s permanece OUTRA', async (utmSource) => {
    const f = fixture(); f.pipeline.chave = "comercial"; f.pipeline.nome = "Revisão de Radar";
    f.pipeline.setores = [{ setor: { nome: "Comercial", ativo: true } }]; f.rules.splice(0, f.rules.length, { perfil: "Comercial", podeVer: true, podeAgir: true });
    f.noloss.utmSource = utmSource;
    const pagina = await listarAlertasLeadsBpm(33, cursor(33, "NOLOSS"), f.client);
    expect(pagina.alertas).toHaveLength(1);
    expect(pagina.alertas[0]).toMatchObject({ origem: "OUTRA", cnpj: null, nome: "Contato Fictício", destino: { tipo: "LEAD_VIRTUAL" } });
    expect(f.io.nolossLead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "pending", promotedCardId: null, promotedByUserId: null }) }));
    for (const spy of f.writeSpies) expect(spy).not.toHaveBeenCalled();
  });
  it("lookup virtual com pipeline adulterado falha antes de ler o conteúdo", async () => {
    const f = fixture();
    expect(await obterAlertaLeadPendenteBpm(21, { tipo: "LEAD_VIRTUAL", pipelineId: sourcePipelineId, origemLead: "noloss", leadId: "noloss-fixture" }, f.client)).toBeNull();
    expect(f.io.nolossLead.findFirst).not.toHaveBeenCalled();
  });
  it.each(["outrousuario", "json-array", "versao-estrangeira", "extra", "base64-malformado"])("cursor sem contrato não ganha escopo: %s", (caso) => {
    let token = cursor(21);
    if (caso === "outrousuario") token = cursor(22);
    if (caso === "json-array") token = Buffer.from("[]").toString("base64url");
    if (caso === "versao-estrangeira") token = Buffer.from(JSON.stringify({ ...lerCursorAlertasLeadsBpm(token, 21), versao: 2 })).toString("base64url");
    if (caso === "extra") token = Buffer.from(JSON.stringify({ ...lerCursorAlertasLeadsBpm(token, 21), pipelineId: sourcePipelineId })).toString("base64url");
    if (caso === "base64-malformado") token = "invalid+token/=";
    expect(() => lerCursorAlertasLeadsBpm(token, 21)).toThrow("Cursor inválido");
  });
  it("fanout privado envia só invalidação e isola falha de Pusher", async () => {
    const f = fixture(); state.trigger.mockRejectedValue(new Error("transporte indisponível"));
    await expect(notificarPendenciasLeadsBpm({ pipelineId, etapaId: stageId })).resolves.toBeUndefined();
    expect(state.trigger).toHaveBeenCalledTimes(2);
    for (const [channel, event, payload] of state.trigger.mock.calls) {
      expect(channel).toMatch(/^private-bpm-tarefas-usuario-(21|22)$/);
      expect(event).toBe("bpm-leads-atualizados");
      expect(Object.keys(payload).sort()).toEqual(["pipelineId", "timestamp"]);
      expect(payload.pipelineId).toBe(pipelineId);
    }
    for (const spy of f.writeSpies) expect(spy).not.toHaveBeenCalled();
  });
  it("GET real projeta recepção visível e mantém cache privado, sem worker ou writes", async () => {
    const f = fixture();
    const response = await GET(new Request(`http://localhost/api/bpm/leads/alertas?cursor=${cursor(21)}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ alertas: [{ destino: { cardId, recepcaoId: f.receipt.id } }], proximoCursor: null });
    for (const spy of f.writeSpies) expect(spy).not.toHaveBeenCalled();
  });
  it.each(["anonimo", "inativo", "CRM-revogado", "cursor-estrangeiro", "userId-forjado", "cursor-duplicado"])("GET real nega antes da projeção: %s", async (caso) => {
    const f = fixture(); let query = `cursor=${cursor(21)}`;
    if (caso === "anonimo") state.auth.mockResolvedValue(null);
    if (caso === "inativo") f.users[0].status = "INATIVO";
    if (caso === "CRM-revogado") f.overrides.push({ usuarioId: 21, modulo: "crm", acao: "REMOVE" });
    if (caso === "cursor-estrangeiro") query = `cursor=${cursor(22)}`;
    if (caso === "userId-forjado") query += "&usuarioId=22";
    if (caso === "cursor-duplicado") query += `&cursor=${cursor(21)}`;
    const response = await GET(new Request(`http://localhost/api/bpm/leads/alertas?${query}`));
    expect(response.status).toBe(caso === "anonimo" ? 401 : ["inativo", "CRM-revogado"].includes(caso) ? 403 : 400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(f.io.bpmCardHistorico.findMany).not.toHaveBeenCalled();
    for (const spy of f.writeSpies) expect(spy).not.toHaveBeenCalled();
  });
});
