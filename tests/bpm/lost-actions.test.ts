import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOTIVOS_LOST,
  resolverConfiguracaoLost,
  validarMotivoLost,
} from "@/lib/bpm/lost";

const root = process.cwd();
const ler = (arquivo: string) => readFileSync(path.join(root, arquivo), "utf8");

describe("Lost — contrato canônico", () => {
  const campos = [
    {
      id: "motivo",
      pipelineId: "pipeline",
      etapaId: "lost",
      nome: "Motivo de Lost",
      tipo: "selecao",
      opcoesJson: JSON.stringify(MOTIVOS_LOST),
      obrigatorio: true,
      ordem: 1,
    },
    {
      id: "outro",
      pipelineId: "pipeline",
      etapaId: "lost",
      nome: "Motivo de Lost - Outro",
      tipo: "texto",
      opcoesJson: null,
      obrigatorio: false,
      ordem: 2,
    },
  ];

  it("resolve motivo e complemento somente entre campos configurados na etapa Lost", () => {
    const resultado = resolverConfiguracaoLost({ camposPipeline: campos, etapaLostId: "lost" });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.configuracao.motivo.id).toBe("motivo");
      expect(resultado.configuracao.complemento.id).toBe("outro");
    }
  });

  it("rejeita campo de motivo associado a outra etapa", () => {
    expect(resolverConfiguracaoLost({
      camposPipeline: [{ ...campos[0], etapaId: "outra" }, campos[1]],
      etapaLostId: "lost",
    })).toMatchObject({ success: false });
  });

  it("mantém validação do complemento para a opção Outro", () => {
    const resultado = resolverConfiguracaoLost({ camposPipeline: campos, etapaLostId: "lost" });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(validarMotivoLost({
      configuracao: resultado.configuracao,
      valores: { motivo: "Outro", outro: "" },
    })).toMatchObject({ success: false });
  });

  it("runtime Lost não consulta relações obrigatórias/ocultas legadas", () => {
    const cards = ler("src/actions/bpm/Cards.ts");
    expect(cards).toContain("etapaConfiguracoes: { some: { etapaId: params.etapaLostId");
    expect(cards).not.toContain("bpmCampoObrigatorioEtapa");
    expect(cards).not.toContain("bpmCampoOcultoEtapa");
  });
});
