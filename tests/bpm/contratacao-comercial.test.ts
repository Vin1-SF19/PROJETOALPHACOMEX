import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({ acesso: vi.fn(), evento: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/bpm/ownership", () => ({ checarAcessoBpmCard: mocks.acesso }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: mocks.evento }));
import { acessoAcompanhamentoComercial, carregarAcompanhamentoComercial, disponibilizarContratoComercial, idTarefaContratacao } from "@/lib/bpm/contratacao-comercial-server";
import { eventoDominioInputSchema } from "@/lib/bpm/automacoes/central-schemas";
import { concluirTarefaSchema } from "@/lib/validations/bpm";
import { CHAVES_CAMPOS as C } from "@/lib/bpm/financeiro-config.client";
import { etapaEhFechado } from "@/lib/bpm/status-pos-fechamento";
import { etapaEhStandbyFollowUp } from "@/lib/bpm/novos-leads";
import { comAutoriaOriginalRd, projetarEventosHistoricoRd } from "@/lib/bpm/rd-station-history";

function fixture() {
  const comercial = { id: "comercial-1", pipelineId: "radar", responsavelId: 7, updatedAt: new Date(), status: "CONCLUIDO", statusPosFechamento: "AGUARDANDO_CONTRATO",
    pipeline: { nome: "Revisão de Radar", chave: null }, etapa: { nome: "Contrato fechado", chave: "fechado", visibilidades: [] }, vinculosOrigem: [{ cardDestinoId: "fin-1" }] };
  const financeiro = { id: "fin-1", pipelineId: "financeiro", responsavelId: 9, updatedAt: new Date(), status: "ATIVO",
    campoValores: [{ campoId: "elaborado", valor: "Sim", campo: { chave: C.CONTRATO_ELABORADO as string } }, { campoId: "link", valor: "anexo-1", campo: { chave: C.LINK_CONTRATO as string } }], vinculosDestino: [{ cardOrigemId: comercial.id }] };
  const tx = { bpmCard: { findUnique: vi.fn().mockResolvedValue(comercial), findUniqueOrThrow: vi.fn().mockResolvedValue(financeiro), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    bpmCardAnexo: { findFirst: vi.fn().mockResolvedValue({ id: "anexo-1", nome: "Contrato.pdf", tipo: "application/pdf", url: "bpm-blob:bpm/fin-1/contrato.pdf" }) },
    documentoGerado: { findUnique: vi.fn() }, bpmCardVinculo: { findMany: vi.fn().mockResolvedValue([{ cardOrigemId: comercial.id }]) },
    bpmTarefa: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() }, bpmCardHistorico: { create: vi.fn() } };
  return { comercial, financeiro, mocks: tx, tx: tx as unknown as Prisma.TransactionClient };
}
beforeEach(() => vi.clearAllMocks());

describe("alinhamento de etapas e autoria", () => {
  it("aceita nomes antigo/novo e prioriza chave técnica", () => {
    expect(etapaEhFechado("Fechado")).toBe(true);
    expect(etapaEhFechado("Contrato fechado")).toBe(true);
    expect(etapaEhFechado("Outro nome", "fechado")).toBe(true);
    expect(etapaEhFechado("Fechado", "lost")).toBe(false);
    expect(etapaEhStandbyFollowUp("Stand By")).toBe(true);
    expect(etapaEhStandbyFollowUp("Stand-by — follow-up semanal")).toBe(true);
    expect(etapaEhStandbyFollowUp("Stand By", "lost")).toBe(false);
  });
  it("usa autor da atividade e preserva projeção verificada, nunca proprietário do negócio", () => {
    expect(comAutoriaOriginalRd({}, { owner: { name: "Dono" }, user_id: "42" })).toEqual({});
    expect(comAutoriaOriginalRd({}, { user: { name: "Autora" } })).toEqual({ authorName: "Autora" });
    expect(comAutoriaOriginalRd({ authorName: "Original" }, { author: { name: "Outra" } })).toEqual({ authorName: "Original" });
    expect(projetarEventosHistoricoRd({}, [{ id: "1", author: { name: "Autora" }, text: "Nota" }], new Map())[0].projection.authorName).toBe("Autora");
  });
});
describe("documento da contratação", () => {
  it("exige o anexo da mesma contratação e campo", async () => {
    const f = fixture();
    expect((await carregarAcompanhamentoComercial("comercial-1", f.tx))?.documento?.anexoId).toBe("anexo-1");
    expect(f.mocks.bpmCardAnexo.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "anexo-1", cardId: "fin-1", campoId: "link" } }));
    f.mocks.bpmCardAnexo.findFirst.mockResolvedValue(null);
    expect((await carregarAcompanhamentoComercial("comercial-1", f.tx))?.documento).toBeNull();
  });
  it("não libera documento sem elaboração explícita, nem anexo com URL externa", async () => {
    const f = fixture(); f.financeiro.campoValores[0].valor = "Não";
    expect((await carregarAcompanhamentoComercial("comercial-1", f.tx))?.documento).toBeNull();
    expect(f.mocks.bpmCardAnexo.findFirst).not.toHaveBeenCalled();
    f.financeiro.campoValores[0].valor = "Sim";
    f.mocks.bpmCardAnexo.findFirst.mockResolvedValue({ id: "anexo-1", nome: "Contrato.pdf", tipo: "application/pdf", url: "https://evil.example/contrato.pdf" });
    expect((await carregarAcompanhamentoComercial("comercial-1", f.tx))?.documento).toBeNull();
  });
  it("documento gerado exige FINALIZADO, PDF e origem financeira correta", async () => {
    const f = fixture();
    f.mocks.bpmCardAnexo.findFirst.mockResolvedValue({ id: "anexo-1", nome: "Contrato", tipo: "application/x-painel-alpha-documento", url: "/PainelAlpha/GeradorDocumentos/conferencia/12345678-1234-1234-1234-123456789abc" });
    const gerado = { status: "CONFERENCIA", pdfUrl: "https://store.public.blob.vercel-storage.com/gerador-documentos/pdfs-gerados/7/contrato.pdf", variaveisJson: { __bpmCardId: "fin-1" } };
    f.mocks.documentoGerado.findUnique.mockResolvedValue(gerado);
    expect((await carregarAcompanhamentoComercial("comercial-1", f.tx))?.documento).toBeNull();
    expect(f.mocks.documentoGerado.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenAcesso: "12345678-1234-1234-1234-123456789abc" } }));
    gerado.status = "FINALIZADO";
    expect((await carregarAcompanhamentoComercial("comercial-1", f.tx))?.documento?.armazenamento).toBe("gerado");
    gerado.variaveisJson.__bpmCardId = "outro-financeiro";
    expect((await carregarAcompanhamentoComercial("comercial-1", f.tx))?.documento).toBeNull();
  });
  it("recusa vínculos ambíguos e não infere contratação pela empresa", async () => {
    const f = fixture(); f.comercial.vinculosOrigem.push({ cardDestinoId: "fin-2" });
    await expect(carregarAcompanhamentoComercial("comercial-1", f.tx)).rejects.toThrow("mais de uma");
    expect(idTarefaContratacao("pagamento", "contrato-1", "fin-1")).not.toBe(idTarefaContratacao("pagamento", "contrato-2", "fin-2"));
  });
});
describe("retorno automático", () => {
  it("cria tarefa, status e histórico uma vez, com CAS", async () => {
    const f = fixture();
    expect(await disponibilizarContratoComercial(f.tx, "fin-1", 9)).toEqual({ cardId: "comercial-1", pipelineId: "radar" });
    expect(f.mocks.bpmCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "comercial-1", updatedAt: f.comercial.updatedAt } }));
    expect(f.mocks.bpmTarefa.create).toHaveBeenCalledOnce();
    expect(f.mocks.bpmCardHistorico.create).toHaveBeenCalledOnce();
    f.mocks.bpmTarefa.findUnique.mockResolvedValue({ id: "existente" });
    expect(await disponibilizarContratoComercial(f.tx, "fin-1", 9)).toBeNull();
    expect(f.mocks.bpmTarefa.create).toHaveBeenCalledOnce();
  });
  it.each(["CONTRATO_ENVIADO", "CONTRATO_ASSINADO", "PAGAMENTO_CONFIRMADO"])("não regride %s", async (status) => {
    const f = fixture(); f.comercial.statusPosFechamento = status;
    expect(await disponibilizarContratoComercial(f.tx, "fin-1", null)).toBeNull();
    expect(f.mocks.bpmCard.updateMany).not.toHaveBeenCalled();
  });
  it("ignora contratação já enviada no Financeiro, mesmo com Comercial atrasado", async () => {
    const f = fixture();
    f.financeiro.campoValores.push({ campoId: "enviado", valor: "Sim", campo: { chave: C.CONTRATO_ENVIADO } });
    expect(await disponibilizarContratoComercial(f.tx, "fin-1", 9)).toBeNull();
    expect(f.mocks.bpmCard.updateMany).not.toHaveBeenCalled();
  });
  it("não disponibiliza contratação comercial cancelada", async () => {
    const f = fixture(); f.comercial.status = "CANCELADO";
    expect(await disponibilizarContratoComercial(f.tx, "fin-1", 9)).toBeNull();
    expect(f.mocks.bpmCard.updateMany).not.toHaveBeenCalled();
  });
  it("evento de sistema e ID de tarefa respeitam os schemas reais", async () => {
    const f = fixture();
    await disponibilizarContratoComercial(f.tx, "fin-1", null);
    const evento = mocks.evento.mock.calls[0][0];
    expect(evento.atorTipo).toBe("SISTEMA");
    expect(eventoDominioInputSchema.safeParse({ ...evento, cardId: "cm12345678901234567890123", pipelineId: "cm12345678901234567890124" }).success).toBe(true);
    expect(concluirTarefaSchema.safeParse({ tarefaId: f.mocks.bpmTarefa.create.mock.calls[0][0].data.id }).success).toBe(true);
  });
  it("conflito não cria tarefa/histórico", async () => {
    const f = fixture(); f.mocks.bpmCard.updateMany.mockResolvedValue({ count: 0 });
    await expect(disponibilizarContratoComercial(f.tx, "fin-1", 9)).rejects.toThrow("mudou");
    expect(f.mocks.bpmTarefa.create).not.toHaveBeenCalled();
    expect(f.mocks.bpmCardHistorico.create).not.toHaveBeenCalled();
  });
  it("consulta de colega não ganha ações e não dispensa visibilidade", async () => {
    const f = fixture(); mocks.acesso.mockResolvedValue({ autorizado: true, isAdminGlobal: false, role: "VISUALIZADOR", perfilGlobal: "COMERCIAL" });
    expect(await acessoAcompanhamentoComercial("comercial-1", 7, "COMERCIAL", f.tx)).toBe(false);
    mocks.acesso.mockResolvedValue({ autorizado: false, isAdminGlobal: false });
    await expect(acessoAcompanhamentoComercial("comercial-1", 7, "COMERCIAL", f.tx)).rejects.toThrow("Não autorizado");
  });
});
