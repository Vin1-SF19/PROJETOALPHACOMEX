import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  auth: vi.fn(), acessoCard: vi.fn(), acessoPipeline: vi.fn(), enviar: vi.fn(),
  notificar: vi.fn(), revalidar: vi.fn(),
  db: {
    usuarios: { findUnique: vi.fn() }, bpmCard: { findUnique: vi.fn() },
    bpmAutomacao: { findFirst: vi.fn(), findMany: vi.fn() }, bpmEtapa: { findFirst: vi.fn() },
    bpmCardVinculo: { findFirst: vi.fn() }, bpmCardHistorico: { create: vi.fn(), findFirst: vi.fn() },
    bpmAutomacaoExecucao: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("../../auth", () => ({ auth: f.auth }));
vi.mock("@/lib/prisma", () => ({ default: f.db }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidar }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: f.acessoCard,
  exigirAcessoBpmPipeline: f.acessoPipeline, isAdminRole: (role: string) => ["Admin", "TI", "CEO"].includes(role) }));
vi.mock("@/lib/bpm/automacoes/encaminhamento", () => ({ executarEncaminhamentoBpm: f.enviar }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: f.notificar }));

import { ObterEncaminhamentosCardBpm, RepetirEncaminhamentoCardBpm, SolicitarEncaminhamentoCardBpm } from "@/actions/bpm/Encaminhamentos";

const cardId = "cmvi5ztja000007l8livtiw1o";
const automacaoId = "c17d0860b8a679fdf3caffac8";
const execucaoId = "cmvi6noob000107jsl7woixxn";
const destinoId = "cmvi67lh7000107l55f0f8qk2";
const origemId = "draft-stage-2484d2bc-34dd-49b6-baf8-e53d58f07a83";
const parametros = { pipelineId: "cmuih4i54000209gmmyqrg557", etapaId: "draft-stage-92d707af-9b90-4f71-a9be-58ec7fbe98f8",
  vincularAoOriginal: true, somenteSeNaoExistirAtivo: true };
const entrada = () => ({ cardId, automacaoId, etapaOrigemEsperadaId: origemId, versaoEsperada: 7, idempotencyKey: "pedido-auditoria-unico" });
const data = new Date("2026-10-21T15:00:00Z");
let card: { id: string; pipelineId: string; etapaId: string; versao: number; empresaId: number; status: string };
let automacao: { id: string; pipelineId: string; etapaId: string; ativa: boolean; acaoTipo: string; nome: string; parametrosJson: string };
type Execucao = { id: string; cardId: string; automacaoId: string; status: string; gatilhoTipo: string; createdAt: Date; executadoEm: Date | null;
  automacao: typeof automacao };
let execucao: Execucao | null;
let vinculo: { cardDestinoId: string; createdAt: Date } | null;

beforeEach(() => {
  vi.resetAllMocks();
  card = { id: cardId, pipelineId: "cmuih48la000009gmzw3wwuzf", etapaId: origemId, versao: 7, empresaId: 3066, status: "ATIVO" };
  automacao = { id: automacaoId, pipelineId: card.pipelineId, etapaId: origemId, ativa: true,
    acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", nome: "Encaminhar ao Financeiro", parametrosJson: JSON.stringify(parametros) };
  execucao = null; vinculo = null;
  f.auth.mockResolvedValue({ user: { id: "1", role: "Admin" } });
  f.db.usuarios.findUnique.mockResolvedValue({ id: 1, role: "Admin", status: "ATIVO" });
  f.acessoCard.mockResolvedValue({ autorizado: true }); f.acessoPipeline.mockResolvedValue({ autorizado: true });
  f.db.bpmCard.findUnique.mockImplementation(async () => ({ ...card }));
  f.db.bpmAutomacao.findFirst.mockImplementation(async () => automacao.ativa ? automacao : null);
  f.db.bpmAutomacao.findMany.mockImplementation(async () => [{ ...automacao, execucoes: execucao ? [execucao] : [] }]);
  f.db.bpmEtapa.findFirst.mockResolvedValue({ id: parametros.etapaId, nome: "Novo Contrato", ativo: true,
    pipeline: { id: parametros.pipelineId, nome: "Financeiro", ativo: true } });
  f.db.bpmCardVinculo.findFirst.mockImplementation(async () => vinculo);
  f.db.bpmCardHistorico.findFirst.mockResolvedValue({ valorNovoJson: JSON.stringify({ execucaoId, parametros }) });
  f.db.bpmAutomacaoExecucao.findUnique.mockImplementation(async () => execucao);
  f.db.bpmAutomacaoExecucao.findFirst.mockImplementation(async ({ where }: { where: { cardId: string; status: string; gatilhoTipo: string } }) =>
    execucao && execucao.cardId === where.cardId && execucao.status === where.status && execucao.gatilhoTipo === where.gatilhoTipo ? execucao : null);
  f.db.bpmAutomacaoExecucao.create.mockImplementation(async ({ data: registro }: { data: { status: string; gatilhoTipo: string } }) => {
    execucao = { id: execucaoId, cardId, automacaoId, status: registro.status, gatilhoTipo: registro.gatilhoTipo,
      createdAt: data, executadoEm: null, automacao };
    return { ...execucao };
  });
  f.db.bpmAutomacaoExecucao.update.mockImplementation(async ({ data: patch }: { data: Partial<Execucao> }) => {
    if (execucao) Object.assign(execucao, patch);
    return execucao;
  });
  f.db.bpmAutomacaoExecucao.updateMany.mockResolvedValue({ count: 1 });
  f.db.$transaction.mockImplementation(async (callback: (tx: typeof f.db) => Promise<unknown>) => callback(f.db));
  f.enviar.mockResolvedValue({ cardId: destinoId, existente: false, versao: 8 });
  f.notificar.mockResolvedValue(undefined);
});

function falhaAnterior() {
  execucao = { id: execucaoId, cardId, automacaoId, status: "FALHA", gatilhoTipo: "ENCAMINHAMENTO_ADMIN",
    createdAt: data, executadoEm: data, automacao };
}

describe("encaminhamentos explícitos: autenticação, autorização e intenção", () => {
  it.each([null, { user: { id: "" } }, { user: { id: "NaN" } }])("recusa sessão inválida sem consultar a regra (%j)", async (session) => {
    f.auth.mockResolvedValue(session);
    expect(await SolicitarEncaminhamentoCardBpm(entrada())).toMatchObject({ success: false, error: "Não autorizado" });
    expect(f.db.bpmAutomacao.findFirst).not.toHaveBeenCalled(); expect(f.enviar).not.toHaveBeenCalled();
  });
  it.each([{ role: "COMERCIAL", status: "ATIVO" }, { role: "Admin", status: "INATIVO" }])("usa identidade ativa do banco, não o Admin da sessão: %j", async (usuario) => {
    f.db.usuarios.findUnique.mockResolvedValue({ id: 1, ...usuario });
    expect(await SolicitarEncaminhamentoCardBpm(entrada())).toMatchObject({ success: false, error: "Não autorizado" });
    expect(f.db.$transaction).not.toHaveBeenCalled(); expect(f.enviar).not.toHaveBeenCalled();
  });
  it("recusa card sem acesso mesmo quando a conta é Admin", async () => {
    f.acessoCard.mockRejectedValue(new Error("Não autorizado"));
    expect(await SolicitarEncaminhamentoCardBpm(entrada())).toMatchObject({ success: false });
    expect(f.enviar).not.toHaveBeenCalled();
  });
  it("recusa acesso ao destino antes de criar execução ou histórico", async () => {
    f.acessoPipeline.mockRejectedValue(new Error("Não autorizado"));
    expect(await SolicitarEncaminhamentoCardBpm(entrada())).toMatchObject({ success: false });
    expect(f.db.bpmAutomacaoExecucao.create).not.toHaveBeenCalled(); expect(f.db.bpmCardHistorico.create).not.toHaveBeenCalled();
  });
  it.each([{ excecaoAdministrativa: true }, { parametros: { ...parametros, pipelineId: "outro" } }, { usuarioId: 2 }])("rejeita autoridade/destino forjados no payload: %j", async (extra) => {
    expect(await SolicitarEncaminhamentoCardBpm({ ...entrada(), ...extra })).toMatchObject({ success: false });
    expect(f.auth).not.toHaveBeenCalled(); expect(f.enviar).not.toHaveBeenCalled();
  });
  it.each(["versao", "etapa", "pipeline", "arquivado", "inativa"]) ("não envia com contexto obsoleto ou regra inválida: %s", async (caso) => {
    if (caso === "versao") card.versao++;
    if (caso === "etapa") card.etapaId = parametros.etapaId;
    if (caso === "pipeline") card.pipelineId = parametros.pipelineId;
    if (caso === "arquivado") card.status = "ARQUIVADO";
    if (caso === "inativa") automacao.ativa = false;
    expect(await SolicitarEncaminhamentoCardBpm(entrada())).toMatchObject({ success: false });
    expect(f.enviar).not.toHaveBeenCalled(); expect(f.db.bpmAutomacaoExecucao.create).not.toHaveBeenCalled();
  });
  it("envia a regra autorizada com autoria e snapshot sem fabricar conclusão", async () => {
    const result = await SolicitarEncaminhamentoCardBpm(entrada());
    expect(result).toMatchObject({ success: true, data: { execucaoId, cardDestinoId: destinoId, versao: 8 } });
    expect(f.acessoPipeline).toHaveBeenCalledWith(parametros.pipelineId, 1);
    expect(f.enviar).toHaveBeenCalledWith({ cardId, execucaoId, automacaoId, parametros }, f.db);
    const registro = f.db.bpmCardHistorico.create.mock.calls[0][0].data;
    expect(registro).toMatchObject({ cardId, usuarioId: 1, acao: "ENCAMINHAMENTO_ADMIN_SOLICITADO" });
    expect(JSON.parse(registro.valorNovoJson)).toMatchObject({ parametros, versaoEsperada: 7, excecaoAdministrativa: true, statusOrigemPreservado: "ATIVO" });
    expect(card.status).toBe("ATIVO"); expect(execucao?.status).toBe("SUCESSO");
  });
  it("falha de cache/realtime após commit mantém SUCESSO e o destino retornado", async () => {
    f.revalidar.mockImplementation(() => { throw new Error("Cache indisponível"); });
    f.notificar.mockRejectedValue(new Error("Realtime indisponível"));
    expect(await SolicitarEncaminhamentoCardBpm(entrada())).toMatchObject({ success: true, data: { cardDestinoId: destinoId } });
    expect(execucao?.status).toBe("SUCESSO");
    expect(f.db.bpmAutomacaoExecucao.update.mock.calls.some(([arg]) => arg.data.status === "FALHA")).toBe(false);
  });
  it("falha real do envio mantém diagnóstico e não retorna destino enviado", async () => {
    f.enviar.mockRejectedValue(new Error("Falha de gravação sintética"));
    expect(await SolicitarEncaminhamentoCardBpm(entrada())).toMatchObject({ success: false });
    expect(execucao?.status).toBe("FALHA"); expect(f.notificar).not.toHaveBeenCalled();
  });
});

describe("status e repetição específica", () => {
  it.each(["PENDENTE", "EM_EXECUCAO", "AGUARDANDO"]) ("mostra operação %s em andamento e bloqueia novo envio", async (status) => {
    falhaAnterior(); execucao!.status = status;
    expect(await ObterEncaminhamentosCardBpm(cardId)).toMatchObject({ success: true, data: { regras: [{ estado: "AGUARDANDO", podeEnviar: false, podeRepetir: false }] } });
    expect(await SolicitarEncaminhamentoCardBpm(entrada())).toMatchObject({ success: false, error: "O encaminhamento já está em andamento." });
    expect(f.enviar).not.toHaveBeenCalled();
  });
  it("leitor comum vê estado sem ganhar envio administrativo", async () => {
    f.db.usuarios.findUnique.mockResolvedValue({ id: 1, role: "COMERCIAL", status: "ATIVO" });
    expect(await ObterEncaminhamentosCardBpm(cardId)).toMatchObject({ success: true, data: { regras: [{ estado: "NAO_DISPARADO", podeEnviar: false, podeRepetir: false }] } });
  });
  it.each(["ENTRAR_COLUNA", "CARD_ATUALIZADO"])("Admin pode solicitar envio isolado após falha %s sem replay", async (gatilhoTipo) => {
    falhaAnterior(); execucao!.gatilhoTipo = gatilhoTipo;
    const result = await ObterEncaminhamentosCardBpm(cardId);
    expect(result).toMatchObject({ success: true, data: { regras: [{ estado: "FALHOU", podeEnviar: true, podeRepetir: false,
      motivo: expect.stringContaining("sem repetir outras ações") }] } });
    expect(f.db.bpmAutomacaoExecucao.updateMany).not.toHaveBeenCalled(); expect(f.enviar).not.toHaveBeenCalled();
  });
  it("falha administrativa oferece retentativa específica, sem um novo envio paralelo", async () => {
    falhaAnterior();
    expect(await ObterEncaminhamentosCardBpm(cardId)).toMatchObject({ success: true,
      data: { regras: [{ estado: "FALHOU", podeEnviar: false, podeRepetir: true, execucaoId }] } });
  });
  it("configuração alterada exige nova intenção, não reaproveita autorização antiga no retry", async () => {
    falhaAnterior(); automacao.parametrosJson = JSON.stringify({ ...parametros, somenteSeNaoExistirAtivo: false });
    expect(await ObterEncaminhamentosCardBpm(cardId)).toMatchObject({ success: true,
      data: { regras: [{ estado: "NAO_DISPARADO", podeEnviar: true, podeRepetir: false, motivo: expect.stringContaining("regra de envio mudou") }] } });
    expect(await RepetirEncaminhamentoCardBpm({ cardId, execucaoId })).toMatchObject({ success: false,
      error: "A configuração do envio mudou. Atualize o card e solicite um novo encaminhamento." });
    expect(f.db.bpmAutomacaoExecucao.updateMany).not.toHaveBeenCalled(); expect(f.enviar).not.toHaveBeenCalled();
  });
  it("destino inativo não oferece envio mesmo com sessão administrativa", async () => {
    f.db.bpmEtapa.findFirst.mockResolvedValue({ id: parametros.etapaId, nome: "Novo Contrato", ativo: false,
      pipeline: { id: parametros.pipelineId, nome: "Financeiro", ativo: true } });
    expect(await ObterEncaminhamentosCardBpm(cardId)).toMatchObject({ success: true,
      data: { regras: [{ estado: "INDISPONIVEL", podeEnviar: false, podeRepetir: false }] } });
  });
  it("não revela status, nome ou identidade de destino inacessível", async () => {
    f.acessoPipeline.mockRejectedValue(new Error("Não autorizado"));
    expect(await ObterEncaminhamentosCardBpm(cardId)).toEqual({ success: true, data: { regras: [] } });
    expect(f.db.bpmCardVinculo.findFirst).not.toHaveBeenCalled();
  });
  it("não expõe card vinculado quando a ACL daquele destino foi revogada", async () => {
    vinculo = { cardDestinoId: destinoId, createdAt: data };
    f.acessoCard.mockImplementation(async (id: string) => { if (id === destinoId) throw new Error("Não autorizado"); });
    expect(await ObterEncaminhamentosCardBpm(cardId)).toEqual({ success: true, data: { regras: [] } });
  });
  it("reenvio concluído revalida ACL e encontra vínculo da mesma empresa sem executar novamente", async () => {
    falhaAnterior(); execucao!.status = "SUCESSO"; vinculo = { cardDestinoId: destinoId, createdAt: data };
    expect(await SolicitarEncaminhamentoCardBpm(entrada())).toMatchObject({ success: true, data: { existente: true, cardDestinoId: destinoId } });
    expect(f.db.bpmCardVinculo.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { cardOrigemId: cardId,
      cardDestino: { pipelineId: parametros.pipelineId, empresaId: 3066, status: { not: "ARQUIVADO" } } } }));
    expect(f.acessoCard).toHaveBeenCalledWith(destinoId, 1, "Admin", "visualizar");
    expect(f.enviar).not.toHaveBeenCalled();
  });
  it("retentativa usa a versão atual após salvar campos e registra nova autorização", async () => {
    falhaAnterior(); card.versao = 12;
    expect(await RepetirEncaminhamentoCardBpm({ cardId, execucaoId })).toMatchObject({ success: true });
    const registro = f.db.bpmCardHistorico.create.mock.calls[0][0].data;
    expect(JSON.parse(registro.valorNovoJson)).toMatchObject({ execucaoId, versaoEsperada: 12, retentativa: true, parametros });
    expect(f.acessoPipeline).toHaveBeenCalledWith(parametros.pipelineId, 1, f.db);
    expect(f.db.bpmAutomacaoExecucao.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: execucaoId, status: "FALHA" } }));
    expect(f.enviar).toHaveBeenCalledOnce();
  });
  it.each(["outra-origem", "legada", "em-andamento", "etapa-alterada", "regra-inativa"]) ("retentativa não reabre execução não elegível: %s", async (caso) => {
    falhaAnterior();
    if (caso === "outra-origem") execucao!.cardId = destinoId;
    if (caso === "legada") execucao!.gatilhoTipo = "ENTRAR_COLUNA";
    if (caso === "em-andamento") execucao!.status = "EM_EXECUCAO";
    if (caso === "etapa-alterada") card.etapaId = parametros.etapaId;
    if (caso === "regra-inativa") automacao.ativa = false;
    expect(await RepetirEncaminhamentoCardBpm({ cardId, execucaoId })).toMatchObject({ success: false });
    expect(f.db.bpmAutomacaoExecucao.updateMany).not.toHaveBeenCalled(); expect(f.enviar).not.toHaveBeenCalled();
  });
  it("perda da disputa da retentativa não dispara segundo envio", async () => {
    falhaAnterior(); f.db.bpmAutomacaoExecucao.updateMany.mockResolvedValue({ count: 0 });
    expect(await RepetirEncaminhamentoCardBpm({ cardId, execucaoId })).toMatchObject({ success: false });
    expect(f.enviar).not.toHaveBeenCalled(); expect(f.db.bpmCardHistorico.create).not.toHaveBeenCalled();
  });
});
