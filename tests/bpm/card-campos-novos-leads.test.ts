import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(resolve(process.cwd(), arquivo), "utf8");

describe("BPM - restrição de campos do card na etapa Novos leads", () => {
  const board = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx");

  it("card na etapa Novos leads exibe apenas os 5 campos permitidos", () => {
    expect(board).toContain(
      'const radarPretendido = card.campoValores?.find((campo) => campo.campo.nome === "Radar pretendido")?.valor;',
    );
    expect(board).toContain("novosLeads && radarPretendido");
    expect(board).toContain("card.proximoContatoEm !== undefined");
    expect(board).toContain("anotacaoRapidaPendente &&");
    expect(board).toContain("cnpjFormatado &&");
    expect(board).toContain("GrupoAvataresMembrosCard");
  });

  it("mantém os campos originais para as demais etapas (regressão)", () => {
    expect(board).toContain("!novosLeads && nomeFantasiaSecundario");
    expect(board).toContain("!novosLeads && card.servico");
    expect(board).toContain("!novosLeads && canalOrigem");
    expect(board).toContain("!novosLeads && statusConfig");
    expect(board).toContain("!novosLeads && proximaTarefaComPrazo");
    expect(board).toContain("!novosLeads && card._count.tarefas > 0");
    expect(board).toContain("!novosLeads && card._count.anexos > 0");
  });
});
