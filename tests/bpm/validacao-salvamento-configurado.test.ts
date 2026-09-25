import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/campos-formulario-publicado", () => ({ camposPublicadosPorEtapa: vi.fn() }));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({ carregarValoresCanonicosCampos: vi.fn() }));
vi.mock("@/lib/bpm/regras/contexto", () => ({ montarContextoAvaliacaoDoCard: vi.fn() }));

import { prepararSalvamentoConfigurado } from "@/lib/bpm/validacao-salvamento-configurado";
import { camposPublicadosPorEtapa } from "@/lib/bpm/campos-formulario-publicado";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";

const etapaId = "cmt36ivq0001dkw0ax7jkz33c";
const elaboradoId = "cmt36ivq9001fkw0aw172i84z";
const dataId = "cmt36ivqg001hkw0aebtrscl4";
const enviadoId = "cmt36ivqq001jkw0a3xk98usr";
const linkId = "cmt36ivqw001lkw0adgv97zab";
const quandoElaborado = JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: elaboradoId }, operador: "igual", valor: "Sim" }] });
const quandoEnviado = JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: enviadoId }, operador: "igual", valor: "Sim" }] });

function cliente(requisitos: unknown[] = []) {
  return {
    bpmEtapa: { findMany: vi.fn().mockResolvedValue([{ id: etapaId }]) },
    bpmRequisito: { findMany: vi.fn().mockResolvedValue(requisitos) },
    bpmCampoEtapaConfig: { findMany: vi.fn().mockResolvedValue([{
      campoId: dataId, valorPadrao: "{{agora.data}}", condicaoObrigatoriedadeJson: quandoElaborado,
      campo: { id: dataId, nome: "Data de elaboração", tipo: "data", opcoesJson: null },
    }]) },
    bpmCampo: { findMany: vi.fn().mockResolvedValue([
      { id: elaboradoId, nome: "Contrato elaborado", escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null },
      { id: dataId, nome: "Data de elaboração", escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null },
      { id: enviadoId, nome: "Contrato enviado", escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null },
      { id: linkId, nome: "Link/arquivo do contrato", escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null },
    ]) },
  };
}

const card = { id: "card", pipelineId: "pipeline", etapaId };

beforeEach(() => {
  vi.mocked(camposPublicadosPorEtapa).mockResolvedValue(new Map([[etapaId, new Set([elaboradoId, dataId, enviadoId, linkId])]]));
  vi.mocked(carregarValoresCanonicosCampos).mockResolvedValue({});
  vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: {} });
});

describe("salvamento governado por configuração", () => {
  it("preenche a data configurada só ao marcar Sim e preserva a anterior", async () => {
    const agora = new Date("2026-09-25T15:00:00.000Z");
    const primeiro = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [elaboradoId]: "Sim" }, client: cliente() as never, agora });
    expect(primeiro[dataId]).toBe("2026-09-25");
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: { [dataId]: "2026-09-20" } });
    const segundo = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [elaboradoId]: "Sim" }, client: cliente() as never, agora });
    expect(segundo[dataId]).toBeUndefined();
  });

  it("aceita o autosave parcial do indicador; documento continua obrigatório no avanço", async () => {
    const requisito = { chave: "contrato-link", alvoTipo: "CAMPO", campoId: linkId, campo: { id: linkId, nome: "Link/arquivo do contrato", ativo: true }, condicaoJson: quandoEnviado };
    await expect(prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [enviadoId]: "Sim" }, client: cliente([requisito]) as never }))
      .resolves.toEqual({ [enviadoId]: "Sim" });
  });
});
