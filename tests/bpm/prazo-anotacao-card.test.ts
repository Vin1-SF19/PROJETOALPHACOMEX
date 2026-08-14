import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(resolve(process.cwd(), arquivo), "utf8");

describe("BPM - prazo e anotação pendente no card do board", () => {
  it("carrega somente tarefas pendentes compactas para o board", () => {
    const cards = ler("src/actions/bpm/Cards.ts");
    expect(cards).toContain('where: { status: "PENDENTE" }');
    expect(cards).toContain('select: { titulo: true, prazo: true, tipo: true }');
    expect(cards).toContain("take: 10");
  });

  it("exibe próximo prazo e anotação rápida sem retirar o clique que abre o card", () => {
    const board = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx");
    expect(board).toContain("proximaTarefaComPrazo");
    expect(board).toContain("anotacaoRapidaPendente");
    expect(board).toContain("LEMBRETE_RAPIDO");
    expect(board).toContain(">Prazo<");
    expect(board).toContain(">Anotação<");
    expect(board).toContain("onClick={() => onAbrir(card.id)}");
  });
});
