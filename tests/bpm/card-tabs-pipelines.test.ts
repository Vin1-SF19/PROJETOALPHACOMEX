import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(resolve(process.cwd(), arquivo), "utf8");

describe("BPM - tabs do card exibem pipelines reais (RM-2026-A4294C)", () => {
  const layout = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx");
  const acoes = ler("src/actions/bpm/Cards.ts");
  const painel = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoPipeline.tsx");

  it("não usa mais serviços comerciais como fonte das tabs", () => {
    expect(layout).not.toContain("getServicosComerciais");
    expect(layout).not.toContain("SERVICOS_COMERCIAIS_PADRAO");
    expect(layout).not.toContain("SERVICOS_FIXOS");
    expect(layout).not.toContain('value="card"');
    expect(layout).not.toContain("Este card</TabsTrigger>");
  });

  it("1ª tab exibe o nome do pipeline atual do card (dinâmico)", () => {
    expect(layout).toContain('value={card.pipeline.id}');
    expect(layout).toContain("{card.pipeline.nome}");
  });

  it("demais tabs vêm de ListarPipelinesBpm, excluindo o pipeline atual", () => {
    expect(layout).toContain('import { ListarPipelinesBpm } from "@/actions/bpm/Pipelines"');
    expect(layout).toContain("ListarPipelinesBpm()");
    expect(layout).toContain("p.id !== card.pipelineId");
  });

  it("renderiza uma TabsTrigger e TabsContent por pipeline em outrosPipelines", () => {
    expect(layout).toContain("{outrosPipelines.map((pipeline) => {");
    expect(layout).toContain("{outrosPipelines.map((pipeline) => (");
    expect(layout).toContain("<PainelHistoricoPipeline");
  });

  it("ListarPipelinesBpm ordena por nome e filtra ativos por padrão", () => {
    const pipelines = ler("src/actions/bpm/Pipelines.ts");
    expect(pipelines).toContain('orderBy: { nome: "asc" }');
    expect(pipelines).toContain("incluirInativos ? undefined : { ativo: true }");
  });

  it("ListarCardsEmpresaPorPipeline filtra por empresa e pipelineId, excluindo o card atual", () => {
    expect(acoes).toContain("export async function ListarCardsEmpresaPorPipeline(cardId: string, pipelineId: string)");
    expect(acoes).toContain("empresaId: card.empresaId, pipelineId, id: { not: cardId }");
  });

  it("painel de outro pipeline trata estado vazio sem erro/tela em branco", () => {
    expect(painel).toContain("Esta empresa não possui outros cards em");
    expect(painel).toContain("onAbrirCard(c.id)");
  });
});
