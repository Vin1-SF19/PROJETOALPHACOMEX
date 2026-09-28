import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const cardFindUnique = vi.hoisted(() => vi.fn());
const campoFindMany = vi.hoisted(() => vi.fn());
const consultaFindUnique = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCard: { findUnique: cardFindUnique },
  bpmCampo: { findMany: campoFindMany },
  consultaPreAnalise: { findUnique: consultaFindUnique },
} }));

import { gerarFichaViabilidadeCardBpm } from "@/lib/bpm/ficha-viabilidade-server";
import { montarFichaAlphaDoCard, type CardFonteFicha } from "@/lib/bpm/ficha-viabilidade-dados";

const card: CardFonteFicha = {
  id: "card-123", dataReuniao: new Date("2026-09-28T13:00:00.000Z"),
  transcricaoReuniao: "Transcrição real da reunião", responsavel: { nome: "Vinicius" },
  empresa: {
    razaoSocial: "Empresa Teste", nomeFantasia: "Empresa", cnpj: "12345678000100",
    uf: "SP", dataConstituicao: "2020-03-10", capitalSocial: "150000,00", regimeTributario: "Lucro Presumido",
    pessoas: [{ principal: true, pessoa: { nome: "Ana", celular: "11999999999", email: "ana@example.com", telefoneExtra: null } }],
  },
  reunioes: [{ emailCliente: "outro@example.com" }],
  campoValores: [
    { campoId: "radar", valor: "Revisão de Radar Limitado a USD150k" },
    { campoId: "mes", valor: "2026-10-01" },
    { campoId: "resumo", valor: "Resumo registrado" },
  ],
};
const campos = [
  { id: "radar", chave: "alpha.radar.viabilidade.radar_pretendido", nome: "Radar pretendido" },
  { id: "mes", chave: "alpha.radar.viabilidade.mes_protocolar", nome: "Mês para protocolar" },
  { id: "resumo", chave: "alpha.radar.viabilidade.resumo_reuniao", nome: "Resumo da reunião" },
];

beforeEach(() => vi.clearAllMocks());

describe("ficha de viabilidade", () => {
  it("gera a Ficha Alpha da Pré-Análise com dados persistidos do card", async () => {
    cardFindUnique.mockResolvedValue({ ...card, pipelineId: "pipeline", pipeline: { nome: "Revisão de Radar" }, etapa: { nome: "Reunião Agendada" } });
    campoFindMany.mockResolvedValue(campos);
    consultaFindUnique.mockResolvedValue(null);

    const resultado = await gerarFichaViabilidadeCardBpm("card-123");
    expect(cardFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "card-123" } }));
    expect(consultaFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { cnpj: "12345678000100" } }));
    expect(resultado.nome).toBe("Ficha_Alpha_12345678000100.pdf");
    const documento = await PDFDocument.load(Buffer.from(resultado.base64, "base64"));
    expect(documento.getPageCount()).toBe(2);
    expect(documento.getTitle()).toBe("Ficha Alpha - Empresa Teste");
  });

  it("preenche a ficha com o card e só complementa com Pré-Análise do mesmo CNPJ", () => {
    const consulta = {
      cnpj: "12.345.678/0001-00", regimeEA: "Simples", submodalidade: "Limitado",
      situacao: "Ativo", capitalSocial: 100, nomeResponsavel: "Outro",
      telefoneContato: "0000", observacoes: "Observação antiga",
      dadosBrutos: { rfb: { dados: { natureza_juridica: "Sociedade Limitada" } }, extra: { origemLead: "Google" } },
    };
    const { dados, userLogado } = montarFichaAlphaDoCard({ card, campos, consulta });
    expect(userLogado).toBe("Vinicius");
    expect(dados.rfb?.dados?.razaoSocial).toBe("Empresa Teste");
    expect(dados.rfb?.dados?.natureza_juridica).toBe("Sociedade Limitada");
    expect(dados.extra).toMatchObject({
      nomeResponsavel: "Ana", email: "ana@example.com", dataSituacao: "28/09/2026",
      horaSituacao: "10:00", mesProtocolo: "01/10/2026", origemLead: "Google",
      observacoes: "Resumo registrado",
    });
    expect(dados.viabilidade).toMatchObject({ radarPretendido: "Revisão de Radar Limitado a USD150k", transcricaoRegistrada: true });

    const diferente = montarFichaAlphaDoCard({ card, campos, consulta: { ...consulta, cnpj: "99999999000199" } });
    expect(diferente.dados.rfb?.dados?.natureza_juridica).toBe("");
    expect(diferente.dados.extra?.origemLead).toBe("");
  });

  it("recusa card de outra etapa antes de consultar campos", async () => {
    cardFindUnique.mockResolvedValue({ pipeline: { nome: "Revisão de Radar" }, etapa: { nome: "Novo Lead" } });
    await expect(gerarFichaViabilidadeCardBpm("outro-card")).rejects.toThrow("Reunião Agendada");
    expect(campoFindMany).not.toHaveBeenCalled();
  });
});
