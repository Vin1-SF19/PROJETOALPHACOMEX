import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { agruparCamposPorColuna } from "@/lib/bpm/campos-admin";

const etapas = [
  { id: "etapa-b", nome: "Qualificação", ordem: 2 },
  { id: "etapa-a", nome: "Novos leads", ordem: 1 },
];

const campos = [
  { id: "sem-config", etapaId: "etapa-a", nome: "Legado sem configuração", ordem: 0, etapaConfiguracoes: [] },
  { id: "b-2", etapaId: null, nome: "Receita", ordem: 20, etapaConfiguracoes: [{ etapaId: "etapa-b", ordem: 2 }] },
  { id: "b-1", etapaId: "legado-divergente", nome: "Contato", ordem: 10, etapaConfiguracoes: [{ etapaId: "etapa-b", ordem: 1 }] },
  { id: "compartilhado", etapaId: null, nome: "Compartilhado", ordem: 3, etapaConfiguracoes: [{ etapaId: "outra-pipeline", ordem: 0 }] },
  { id: "multi", etapaId: null, nome: "Multi-etapa", ordem: 4, etapaConfiguracoes: [{ etapaId: "etapa-a", ordem: 2 }, { etapaId: "etapa-b", ordem: 3 }] },
];

describe("agruparCamposPorColuna", () => {
  it("usa BpmCampoEtapaConfig e ignora etapaId legado", () => {
    const grupos = agruparCamposPorColuna(campos, etapas);
    expect(grupos.map(({ nome }) => nome)).toEqual([
      "Novos leads",
      "Qualificação",
      "Sem configuração por etapa",
      "Compartilhados sem etapa neste pipeline",
    ]);
    expect(grupos[1].campos.map(({ id }) => id)).toEqual(["b-1", "b-2", "multi"]);
    expect(grupos[0].campos.map(({ id }) => id)).toEqual(["multi"]);
  });

  it("mantém colunas vazias para deixar a configuração explícita", () => {
    const grupos = agruparCamposPorColuna(campos.filter((campo) => campo.id !== "multi"), etapas);
    expect(grupos.find(({ id }) => id === "etapa-a")?.campos).toEqual([]);
  });

  it("projeta legitimamente o mesmo campo em mais de uma etapa", () => {
    const ids = agruparCamposPorColuna(campos, etapas)
      .flatMap((grupo) => grupo.campos.map((campo) => campo.id));
    expect(ids.filter((id) => id === "multi")).toHaveLength(2);
  });
});

describe("integração com a aba Configurações", () => {
  const admin = readFileSync(
    "src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx",
    "utf8",
  );

  it("mantém somente o formulário canônico e não reintroduz o editor legado de campos", () => {
    expect(admin).toContain("<FormularioEtapaWorkspace");
    expect(admin).toContain("campos={campos}");
    expect(admin).not.toContain("Campos Personalizados");
    expect(admin).not.toContain("Campos aplicáveis nesta etapa");
    expect(admin).not.toContain("agruparCamposPorColuna");
    expect(admin).not.toContain("handleCriarCampo");
    expect(admin).not.toContain("salvarEdicao(campo.id)");
  });
});
