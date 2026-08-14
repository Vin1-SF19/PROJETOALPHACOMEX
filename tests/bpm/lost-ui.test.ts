import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { prepararCamposMotivoLostUi } from "@/lib/bpm/card-modal-ui";

const campos = [
  { id: "motivo", nome: "Motivo de Lost", obrigatorio: true },
  { id: "complemento", nome: "Motivo de Lost - Outro", obrigatorio: false },
  { id: "observacao", nome: "Observação", obrigatorio: false },
];

const raiz = process.cwd();
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

describe("CRM Lost - apresentação condicional do motivo Outro", () => {
  it("mantém o companion escondido e fora dos campos visíveis para motivos comuns", () => {
    const resultado = prepararCamposMotivoLostUi("Lost", campos, {
      motivo: "Sem resposta",
      complemento: "rascunho preservado",
    });

    expect(resultado.exigeComplemento).toBe(false);
    expect(resultado.camposVisiveis.map((campo) => campo.id)).toEqual([
      "motivo",
      "observacao",
    ]);
  });

  it("revela o companion como obrigatório somente quando Outro está selecionado", () => {
    const resultado = prepararCamposMotivoLostUi("  LOST ", campos, {
      motivo: "Outro",
    });

    expect(resultado.exigeComplemento).toBe(true);
    expect(resultado.campoMotivoId).toBe("motivo");
    expect(resultado.campoComplementoId).toBe("complemento");
    expect(resultado.camposVisiveis.find((campo) => campo.id === "complemento"))
      .toMatchObject({ obrigatorio: true });
  });

  it("não interfere nos campos de outras etapas", () => {
    const resultado = prepararCamposMotivoLostUi("Em tratativa", campos, {
      motivo: "Outro",
    });

    expect(resultado.exigeComplemento).toBe(false);
    expect(resultado.camposVisiveis).toBe(campos);
  });

  it("mantém Lost fora da criação e liga requisitos e edição ao contrato compartilhado", () => {
    const board = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx");
    const novoCard = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx");
    const requisitos = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelRequisitosAvanco.tsx");
    const camposEtapa = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx");

    expect(board).not.toContain("etapaEhLost");
    expect(board).not.toContain("campoEhMotivoLostOutro");
    expect(novoCard).not.toContain("prepararCamposMotivoLostUi");
    expect(novoCard).not.toContain("Motivo de Lost");
    expect(requisitos).toContain("prepararCamposMotivoLostUi(");
    expect(camposEtapa).toContain("prepararCamposMotivoLostUi(");
    expect(camposEtapa).toContain("versaoEsperadaEm: versaoBaseCampos");
    expect(camposEtapa).toContain("resolverSnapshotCamposRealtime({");
    expect(camposEtapa).toContain("if (!podeEditar || !camposAtuaisAlterados || conflitoCamposAtuais) return");
    expect(camposEtapa).toContain("Usar dados atualizados");
    expect(requisitos).toContain("&& !conflitoRealtime");
    expect(requisitos).toContain("if (!requisitos || !destinoId || conflitoRealtime) return");
    expect(requisitos).toContain("Usar requisitos atualizados");
  });

  it("expõe feedback acessível e preserva o painel direito", () => {
    const input = ler("src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx");
    const novoCard = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx");
    const requisitos = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelRequisitosAvanco.tsx");
    const camposEtapa = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx");
    const painelReuniao = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx");
    const painelProximaEtapa = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx");

    expect(input).toContain("aria-invalid={invalid || undefined}");
    expect(input).toContain("aria-describedby={describedBy}");
    expect(novoCard).toContain('role="alert"');
    expect(requisitos).toContain('role="alert"');
    expect(camposEtapa).toContain('role="alert"');
    expect(painelReuniao).not.toContain("Motivo de Lost");
    expect(painelProximaEtapa).not.toContain("Motivo de Lost");
  });
});
