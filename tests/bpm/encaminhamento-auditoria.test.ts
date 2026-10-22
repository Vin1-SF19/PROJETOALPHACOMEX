import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/bpm/recebimentos-card-server", () => ({ registrarRecepcaoPipelineBpm: vi.fn().mockResolvedValue(null) }));

const mocks = vi.hoisted(() => ({
  db: {
    bpmAutomacaoExecucao: { findUnique: vi.fn() },
    bpmCard: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    bpmPipeline: { findFirst: vi.fn() }, bpmEtapa: { findFirst: vi.fn() },
    bpmCardVinculo: { findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    bpmCardHistorico: { findFirst: vi.fn(), create: vi.fn() },
    bpmCampo: { findMany: vi.fn() }, usuarios: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  }, copiar: vi.fn(), faltantes: vi.fn(), publicar: vi.fn(), sla: vi.fn(), cadencias: vi.fn(), acessoCard: vi.fn(), acessoPipeline: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: mocks.db }));
vi.mock("@/lib/bpm/ownership", () => ({ isAdminRole: (role: string) => role === "Admin (TI)",
  exigirAcessoBpmCard: mocks.acessoCard, exigirAcessoBpmPipeline: mocks.acessoPipeline }));
vi.mock("@/lib/bpm/copiar-campos-card-vinculado", () => ({ copiarCamposCardVinculado: mocks.copiar }));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarCamposFaltantesCardEtapa: mocks.faltantes }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: mocks.publicar }));
vi.mock("@/lib/bpm/sla", () => ({ criarSlaInstancia: mocks.sla }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: mocks.cadencias }));

import { executarEncaminhamentoBpm } from "@/lib/bpm/automacoes/encaminhamento";
import { validarParametrosAutomacaoBpm, salvarAutomacaoBpmSchema } from "@/lib/bpm/automacoes/schemas";
import { validarParametrosAcaoCentral } from "@/lib/bpm/automacoes/central-schemas";

const pipelineId = "cm1pipeoperacional00000000001";
const etapaId = "draft-stage-802def27-91ae-4231-b3f4-a251951c954a";
const parametros = { pipelineId, etapaId, vincularAoOriginal: true, somenteSeNaoExistirAtivo: true };
const fonte = { id: "card", pipelineId: "financeiro", etapaId: "fim-financeiro", versao: 7, empresaId: 7,
  status: "CONCLUIDO", responsavelId: 9, servico: "Radar", pipeline: { chave: "financeiro", nome: "Financeiro" } };
const executar = (config = parametros) => executarEncaminhamentoBpm({ cardId: "card", execucaoId: "exec", automacaoId: "regra", parametros: config });

function admin() {
  mocks.db.bpmAutomacaoExecucao.findUnique.mockResolvedValue({ cardId: "card", automacaoId: "regra", gatilhoTipo: "ENCAMINHAMENTO_ADMIN",
    automacao: { ativa: true, etapaId: fonte.etapaId, pipelineId: fonte.pipelineId, acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE" } });
  mocks.db.bpmCardHistorico.findFirst.mockResolvedValue({ usuarioId: 1, valorNovoJson: JSON.stringify({ execucaoId: "exec",
    pipelineDestinoId: pipelineId, etapaDestinoId: etapaId, etapaOrigemId: fonte.etapaId, versaoEsperada: fonte.versao, parametros }) });
  mocks.db.usuarios.findUnique.mockResolvedValue({ id: 1, role: "Admin (TI)", status: "ATIVO" });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.$transaction.mockImplementation((callback: (tx: typeof mocks.db) => Promise<unknown>) => callback(mocks.db));
  mocks.db.bpmCard.findUnique.mockResolvedValue({ ...fonte });
  mocks.db.bpmCard.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.bpmCard.create.mockResolvedValue({ id: "destino", createdAt: new Date() });
  mocks.db.bpmCard.findFirst.mockResolvedValue(null);
  mocks.db.bpmPipeline.findFirst.mockResolvedValue({ id: pipelineId, chave: "operacional" });
  mocks.db.bpmEtapa.findFirst.mockResolvedValue({ id: etapaId });
  mocks.db.bpmCardVinculo.findFirst.mockResolvedValue(null);
  mocks.db.bpmCampo.findMany.mockResolvedValue([]);
  mocks.db.bpmAutomacaoExecucao.findUnique.mockResolvedValue({ cardId: "card", automacaoId: "regra", gatilhoTipo: "ENTRAR_COLUNA" });
  mocks.db.bpmCardHistorico.findFirst.mockResolvedValue(null);
  mocks.faltantes.mockResolvedValue([]);
});

describe("compatibilidade dos três encaminhamentos auditados", () => {
  it.each([
    ["cmuih4i54000209gmmyqrg557", "draft-stage-92d707af-9b90-4f71-a9be-58ec7fbe98f8", true],
    ["cmuih4tnh000409gm5z34jvss", etapaId, true],
    ["cmuih4tnh000409gm5z34jvss", "draft-stage-cb2023f8-7e31-438e-83f9-4bb0fc359f79", false],
  ])("valida no legado e central sem desviar para oportunidades (%s)", (pipelineId, etapaId, dedupe) => {
    const entrada = { pipelineId, etapaId, vincularAoOriginal: true, somenteSeNaoExistirAtivo: dedupe };
    expect(validarParametrosAutomacaoBpm("CRIAR_CARD_OUTRO_PIPELINE", entrada)).toEqual(entrada);
    expect(validarParametrosAcaoCentral("CRIAR_CARD_OUTRO_PIPELINE", entrada)).toEqual(entrada);
    expect(salvarAutomacaoBpmSchema.safeParse({ pipelineId: "cmuih48la000009gmzw3wwuzf", etapaId,
      nome: "Encaminhar", gatilhoTipo: "ENTRAR_COLUNA", acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", parametros: entrada }).success).toBe(true);
  });
  it("recusa ação desconhecida e parâmetro de bypass no editor e runtime", () => {
    expect(() => validarParametrosAutomacaoBpm("TIPO_DESCONHECIDO", {})).toThrow("não suportado");
    expect(() => validarParametrosAutomacaoBpm("CRIAR_CARD_OUTRO_PIPELINE", { ...parametros, bypassAdmin: true })).toThrow();
  });
});

describe("handoff compartilhado com autoridade auditada", () => {
  it("mantém guarda normal financeira e não cria destino de card apenas reposicionado", async () => {
    mocks.db.bpmCard.findUnique.mockResolvedValue({ ...fonte, status: "ATIVO" });
    await expect(executar()).rejects.toThrow("precisa estar concluída");
    expect(mocks.db.bpmCard.create).not.toHaveBeenCalled();
    expect(mocks.db.bpmCard.updateMany).not.toHaveBeenCalled();
  });
  it("não publica sucesso quando os campos normais de entrada falham", async () => {
    mocks.faltantes.mockResolvedValue([{ id: "contato", nome: "Contato principal" }]);
    await expect(executar()).rejects.toThrow("Contato principal");
    expect(mocks.publicar).not.toHaveBeenCalled();
  });
  it("Admin explícito libera envio mantendo status e sem fabricar pagamento, assinatura ou NF", async () => {
    admin();
    mocks.db.bpmCard.findUnique.mockResolvedValue({ ...fonte, status: "ATIVO" });
    mocks.faltantes.mockResolvedValue([{ id: "contato", nome: "Contato" }]);
    expect(await executar()).toMatchObject({ cardId: "destino", existente: false, versao: 8 });
    expect(mocks.db.bpmCard.updateMany).toHaveBeenCalledWith({ where: { id: "card", versao: 7 }, data: { versao: { increment: 1 } } });
    expect(mocks.publicar).toHaveBeenCalledWith(expect.objectContaining({ atorTipo: "USUARIO", atorUserId: 1,
      valorNovo: expect.objectContaining({ automacoesSuprimidas: true }) }), mocks.db);
    expect(mocks.cadencias).not.toHaveBeenCalled();
    expect(mocks.db.bpmCardHistorico.create).toHaveBeenCalledWith({ data: expect.objectContaining({ acao: "CARD_ENCAMINHADO",
      valorNovoJson: expect.stringContaining('"statusOrigemPreservado":"ATIVO"') }) });
  });
  it.each(["inativo", "sem papel", "sem histórico", "etapa alterada", "parâmetros alterados", "ACL destino"])("revalida a autorização no executor: %s", async (caso) => {
    admin();
    if (caso === "inativo") mocks.db.usuarios.findUnique.mockResolvedValue({ id: 1, role: "Admin (TI)", status: "INATIVO" });
    if (caso === "sem papel") mocks.db.usuarios.findUnique.mockResolvedValue({ id: 1, role: "Financeiro", status: "ATIVO" });
    if (caso === "sem histórico") mocks.db.bpmCardHistorico.findFirst.mockResolvedValue(null);
    if (caso === "etapa alterada") mocks.db.bpmCard.findUnique.mockResolvedValue({ ...fonte, etapaId: "outra" });
    if (caso === "parâmetros alterados") return expect(executar({ ...parametros, etapaId: "draft-stage-cb2023f8-7e31-438e-83f9-4bb0fc359f79" })).rejects.toThrow();
    if (caso === "ACL destino") mocks.acessoPipeline.mockRejectedValue(new Error("Não autorizado"));
    await expect(executar()).rejects.toThrow();
    expect(mocks.db.bpmCard.create).not.toHaveBeenCalled();
  });
  it("repete o envio sem duplicar destino, histórico, outbox ou versão da origem", async () => {
    mocks.db.bpmCardVinculo.findFirst.mockResolvedValue({ cardDestinoId: "destino" });
    expect(await executar()).toEqual({ cardId: "destino", existente: true, versao: 7 });
    expect(mocks.db.bpmCard.create).not.toHaveBeenCalled();
    expect(mocks.db.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(mocks.publicar).not.toHaveBeenCalled();
  });
  it("CAS perdido não cria card nem publica efeito", async () => {
    mocks.db.bpmCard.updateMany.mockResolvedValue({ count: 0 });
    await expect(executar()).rejects.toThrow("foi atualizado");
    expect(mocks.db.bpmCard.create).not.toHaveBeenCalled();
  });
  it("relê vínculo depois do lock e evita criação concorrente", async () => {
    mocks.db.bpmCardVinculo.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ cardDestinoId: "concorrente" });
    expect(await executar()).toMatchObject({ cardId: "concorrente", existente: true });
    expect(mocks.db.bpmCard.create).not.toHaveBeenCalled();
  });
});
