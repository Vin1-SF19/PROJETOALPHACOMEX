import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  db: {
    bpmAutomacaoExecucao: { updateMany: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    bpmCardHistorico: { create: vi.fn() }, documentoTemplate: { findFirst: vi.fn() },
    documentoGerado: { create: vi.fn(), update: vi.fn() }, documentoClasulaGerada: { createMany: vi.fn() },
    bpmCardAnexo: { findMany: vi.fn(), create: vi.fn() }, bpmCampo: { findFirst: vi.fn() },
    bpmCardCampoValor: { findUnique: vi.fn(), upsert: vi.fn() }, $transaction: vi.fn(),
  }, disponibilizar: vi.fn(), posCommit: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: m.db }));
vi.mock("@/lib/bpm/checklists/integracao", () => ({ montarFatoChecklistAutomacaoBpm: vi.fn().mockResolvedValue({ placeholders: {} }) }));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({ carregarValoresCanonicosCampos: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/bpm/contratacao-comercial-server", () => ({ disponibilizarContratoComercial: m.disponibilizar, notificarContratacaoComercialPosCommit: m.posCommit }));
vi.mock("@/lib/gerador-documentos/pdf", () => ({ gerarPdfDocumento: vi.fn() }));
vi.mock("@/lib/bibble/gerar-ficha-server", () => ({ gerarFichaServer: vi.fn() }));
import { processarFilaAutomacoesBpm } from "@/lib/bpm/automacoes/executor";
const templateId = "c111111111111111111111111";
const campoId = "c222222222222222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.BLOB_READ_WRITE_TOKEN;
  m.db.$transaction.mockImplementation(async (operacao) => typeof operacao === "function" ? operacao(m.db) : Promise.all(operacao));
  m.db.bpmAutomacaoExecucao.updateMany.mockResolvedValue({ count: 1 });
  m.db.bpmAutomacaoExecucao.findMany.mockResolvedValue([{ id: "exec" }]);
  m.db.bpmAutomacaoExecucao.findUnique.mockResolvedValue({ id: "exec", cardId: "financeiro", automacaoId: "regra", eventoChave: "movimento", gatilhoTipo: "ENTRAR_COLUNA",
    automacao: { id: "regra", ativa: true, acaoTipo: "GERAR_CONTRATO", criadoPorId: 7, nome: "Gerar contrato", etapaId: "elaboracao",
      parametrosJson: JSON.stringify({ templateId, campoIdContrato: campoId, titulo: "Contrato teste", variaveis: { __bpmCardId: "card-forjado", objeto: "Exemplo" } }) },
    card: { id: "financeiro", empresaId: 5, pipelineId: "financeiro", etapaId: "elaboracao", responsavelId: 7, empresa: { razaoSocial: "Fictícia", nomeFantasia: null, cnpj: null },
      pipeline: { nome: "Financeiro" }, etapa: { nome: "Elaboração" }, responsavel: { nome: "Closer" } } });
  m.db.documentoTemplate.findFirst.mockResolvedValue({ id: templateId, variaveisJson: [], clausulas: [] });
  m.db.bpmCampo.findFirst.mockResolvedValue({ id: campoId });
  m.db.bpmCardAnexo.findMany.mockResolvedValue([]);
  m.db.bpmCardCampoValor.findUnique.mockResolvedValue(null);
  m.db.bpmCardAnexo.create.mockResolvedValue({ id: "anexo" });
  m.db.documentoGerado.create.mockResolvedValue({ id: "documento" });
  m.disponibilizar.mockResolvedValue(null);
});
it("template não padrão recebe identidade BPM do servidor e continua em CONFERENCIA sem alerta prematuro", async () => {
  expect(await processarFilaAutomacoesBpm()).toMatchObject({ executados: 1, falhos: 0 });
  expect(m.db.documentoGerado.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "CONFERENCIA", clienteId: 5,
    variaveisJson: JSON.stringify({ __bpmCardId: "financeiro", objeto: "Exemplo" }) }) });
  expect(m.db.bpmCardAnexo.create).toHaveBeenCalledWith({ data: expect.objectContaining({ cardId: "financeiro", campoId,
    tipo: "application/x-painel-alpha-documento", url: expect.stringMatching(/^\/PainelAlpha\/GeradorDocumentos\/conferencia\//) }) });
  expect(m.disponibilizar).toHaveBeenCalledWith(m.db, "financeiro", 7);
  expect(m.posCommit).not.toHaveBeenCalled();
});
