import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { criarCadenciaSchema, configurarCadenciaEtapaSchema } from "@/lib/bpm/cadencias/schemas";

const ler = (caminho: string) => readFileSync(caminho, "utf8");

describe("cadência por coluna", () => {
  it("rejeita criação universal e aceita associação explícita", () => {
    expect(criarCadenciaSchema.safeParse({ nome: "Contato", pipelineId: "clw0000000000000pipeline" }).success).toBe(false);
    expect(criarCadenciaSchema.safeParse({
      nome: "Contato",
      pipelineId: "clw0000000000000pipeline",
      etapaId: "clw000000000000000etapa",
    }).success).toBe(true);
    expect(configurarCadenciaEtapaSchema.safeParse({
      pipelineId: "clw0000000000000pipeline",
      etapaId: "clw000000000000000etapa",
      cadenciaId: null,
    }).success).toBe(true);
  });

  it("remove a regra fixa de contatos dos dois caminhos de movimento", () => {
    const fontes = [
      ler("src/actions/bpm/Cards.ts"),
      ler("src/lib/bpm/transicao-command.ts"),
      ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx"),
    ].join("\n");
    expect(fontes).not.toContain("CONTACT_SEQUENCE_REQUIRED");
    expect(fontes).not.toContain("Verificando regra de 8 contatos consecutivos");
    expect(fontes).not.toContain("obterErroContatosConsecutivosParaMovimento");
  });

  it("integra seleção de cadência ou nenhuma no editor real do pipeline", () => {
    const pagina = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx");
    const editor = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx");
    const secao = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/CadenciaEtapasSection.tsx");
    expect(pagina).toContain("ListarCadenciasBpm");
    expect(editor).toContain("<CadenciaEtapasSection");
    expect(secao).toContain("Nenhuma cadência");
    expect(secao).toContain("nunca impedem o avanço do card");
  });

  it("não mantém fallback universal no resolvedor operacional", () => {
    const resolvedor = ler("src/lib/bpm/cadencias/ativacao-automatica.ts");
    expect(resolvedor).toContain("pipelineId: input.pipelineDestinoId");
    expect(resolvedor).toContain("etapaId: input.etapaDestinoId");
    expect(resolvedor).not.toContain("etapaId: null");
    expect(resolvedor).not.toContain("pipelineId: null");
  });
});
