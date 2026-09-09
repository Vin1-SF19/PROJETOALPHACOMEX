import { describe, expect, it } from "vitest";
import {
  CONFIGURACAO_LOST_INVALIDA_MENSAGEM,
  MOTIVOS_LOST,
  campoEhMotivoLost,
  campoEhMotivoLostOutro,
  etapaEhLost,
  motivoLostExigeComplemento,
  resolverConfiguracaoLost,
  validarMotivoLost,
  type CampoConfiguracaoLost,
} from "@/lib/bpm/lost";

const PIPELINE_ID = "pipeline";
const LOST_ID = "lost";

const motivo: CampoConfiguracaoLost = {
  id: "motivo",
  pipelineId: PIPELINE_ID,
  etapaId: LOST_ID,
  nome: "Motivo de Lost",
  tipo: "selecao",
  opcoesJson: JSON.stringify(MOTIVOS_LOST),
  obrigatorio: true,
  ordem: 1,
};
const complemento: CampoConfiguracaoLost = {
  id: "complemento",
  pipelineId: PIPELINE_ID,
  etapaId: LOST_ID,
  nome: "Motivo de Lost - Outro",
  tipo: "texto",
  opcoesJson: null,
  obrigatorio: false,
  ordem: 2,
};

function resolver(
  camposPipeline: CampoConfiguracaoLost[] = [motivo, complemento],
) {
  return resolverConfiguracaoLost({
    camposPipeline,
    etapaLostId: LOST_ID,
  });
}

describe("regra de Motivo de Lost", () => {
  it("expõe identificadores client-safe normalizados", () => {
    expect(etapaEhLost("  LÓST ")).toBe(true);
    expect(campoEhMotivoLost("MOTIVO DE LÓST")).toBe(true);
    expect(campoEhMotivoLostOutro("Motivo de Lóst - Outro")).toBe(true);
    expect(motivoLostExigeComplemento(" Óutro ")).toBe(true);
  });

  it("aceita exatamente o select e o companion configurados na etapa canônica", () => {
    const resultado = resolver();
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.configuracao.motivo.id).toBe("motivo");
      expect(resultado.configuracao.complemento.id).toBe("complemento");
    }
  });

  it.each([
    [] as CampoConfiguracaoLost[],
    [motivo],
    [motivo, motivo, complemento],
    [{ ...motivo, tipo: "texto" }, complemento],
    [{ ...motivo, opcoesJson: "[]" }, complemento],
    [{ ...motivo, opcoesJson: JSON.stringify([...MOTIVOS_LOST].reverse()) }, complemento],
    [motivo, { ...complemento, tipo: "selecao" }],
    [motivo, { ...complemento, etapaId: "outra-etapa" }],
  ].map((campos) => ({ campos })))("falha fechada para configuração ausente, ambígua ou incompatível", ({ campos }) => {
    expect(resolver(campos)).toEqual({
      success: false,
      error: CONFIGURACAO_LOST_INVALIDA_MENSAGEM,
    });
  });

  it("falha fechada quando a configuração canônica de obrigatoriedade diverge", () => {
    expect(resolver([{ ...motivo, obrigatorio: false }, complemento])).toEqual({
      success: false,
      error: CONFIGURACAO_LOST_INVALIDA_MENSAGEM,
    });
    expect(resolver([motivo, { ...complemento, obrigatorio: true }])).toEqual({
      success: false,
      error: CONFIGURACAO_LOST_INVALIDA_MENSAGEM,
    });
  });

  it.each(MOTIVOS_LOST.filter((opcao) => opcao !== "Outro"))(
    "aceita o motivo canônico %s sem companion",
    (opcao) => {
      const resultado = resolver();
      expect(resultado.success).toBe(true);
      if (!resultado.success) return;
      expect(validarMotivoLost({
        configuracao: resultado.configuracao,
        valores: { motivo: opcao },
      })).toEqual({
        success: true,
        valores: { motivo: opcao, complemento: "" },
      });
    },
  );

  it("exige texto não vazio somente quando Outro está selecionado", () => {
    const resultado = resolver();
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(validarMotivoLost({
      configuracao: resultado.configuracao,
      valores: { motivo: "Outro", complemento: "   " },
    })).toEqual({ success: false, error: "Descreva o Motivo de Lost - Outro." });
    expect(validarMotivoLost({
      configuracao: resultado.configuracao,
      valores: { motivo: "Outro", complemento: "  Mudou a estratégia  " },
    })).toEqual({
      success: true,
      valores: { motivo: "Outro", complemento: "Mudou a estratégia" },
    });
  });

  it("rejeita ausência e opção fora do catálogo", () => {
    const resultado = resolver();
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(validarMotivoLost({
      configuracao: resultado.configuracao,
      valores: {},
    }).success).toBe(false);
    expect(validarMotivoLost({
      configuracao: resultado.configuracao,
      valores: { motivo: "Preço" },
    }).success).toBe(false);
  });
});
