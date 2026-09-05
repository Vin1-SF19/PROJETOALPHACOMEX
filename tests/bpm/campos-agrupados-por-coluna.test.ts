import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { agruparCamposPorColuna } from "@/lib/bpm/campos-admin";

const etapas = [
  { id: "etapa-b", nome: "Qualificação", ordem: 2 },
  { id: "etapa-a", nome: "Novos leads", ordem: 1 },
];

const campos = [
  { id: "geral", etapaId: null, nome: "CNPJ", ordem: 0 },
  { id: "b-2", etapaId: "etapa-b", nome: "Receita", ordem: 2 },
  { id: "b-1", etapaId: "etapa-b", nome: "Contato", ordem: 1 },
  { id: "inativo", etapaId: "etapa-antiga", nome: "Legado", ordem: 0 },
];

describe("agruparCamposPorColuna", () => {
  it("ordena as seções pelas etapas e mantém os campos gerais separados", () => {
    const grupos = agruparCamposPorColuna(campos, etapas);
    expect(grupos.map(({ nome }) => nome)).toEqual([
      "Todas as etapas",
      "Novos leads",
      "Qualificação",
      "Etapa inativa ou indisponível",
    ]);
    expect(grupos[2].campos.map(({ id }) => id)).toEqual(["b-1", "b-2"]);
  });

  it("mantém colunas vazias para deixar a configuração explícita", () => {
    const grupos = agruparCamposPorColuna(campos, etapas);
    expect(grupos.find(({ id }) => id === "etapa-a")?.campos).toEqual([]);
  });

  it("não perde nem duplica campos", () => {
    const ids = agruparCamposPorColuna(campos, etapas)
      .flatMap((grupo) => grupo.campos.map((campo) => campo.id));
    expect(ids.sort()).toEqual(campos.map(({ id }) => id).sort());
  });
});

describe("integração com a aba Configurações", () => {
  const admin = readFileSync(
    "src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx",
    "utf8",
  );

  it("renderiza os grupos e seus estados vazios sem remover o CRUD", () => {
    expect(admin).toContain("agruparCamposPorColuna(filtrados, etapas)");
    expect(admin).toContain("Campos configurados nesta coluna");
    expect(admin).toContain("Nenhum campo configurado nesta coluna");
    expect(admin).toContain("handleCriarCampo");
    expect(admin).toContain("salvarEdicao(campo.id)");
    expect(admin).toContain("alterarAtivacaoCampo(campo.id, campo.nome, campo.ativo === false)");
    expect(admin).toContain("handleToggleObrigatorio");
  });
});
