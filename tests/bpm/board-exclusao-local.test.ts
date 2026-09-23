import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relative: string) => readFileSync(resolve(relative), "utf8");

describe("PipelineBoardClient — remoção local sem Pusher", () => {
  it("define removerCardLocal que filtra o card do estado", () => {
    const board = source("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx");
    expect(board).toContain("removerCardLocal");
    expect(board).toContain("prev.filter((c) => c.id !== cardId)");
  });

  it("passa onCardExcluido para CardFullViewModal", () => {
    const board = source("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx");
    expect(board).toContain("onCardExcluido={removerCardLocal}");
  });

  it("distingue erro de carregamento de estado vazio", () => {
    const board = source("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx");
    // Banner de erro
    expect(board).toContain('role="alert"');
    // Banner de estado vazio (só quando !erro)
    expect(board).toContain("!erro && cards.length === 0");
  });
});

describe("ExcluirCardBpm — resiliência Pusher", () => {
  it("envolve notificarPipelineBpm em try/catch (falha de transporte não reverte exclusão)", () => {
    const cards = source("src/actions/bpm/CardsExcluir.ts");
    // O try/catch ao redor do notificarPipelineBpm garante que a exclusão
    // persistida não é revertida por falha de transporte.
    const notifyBlock = cards.match(/try\s*\{[\s\S]*?notificarPipelineBpm[\s\S]*?\}\s*catch/);
    expect(notifyBlock).not.toBeNull();
  });

  it("loga falha de notificação sem propagar erro ao chamador", () => {
    const cards = source("src/actions/bpm/CardsExcluir.ts");
    expect(cards).toContain("Falha na notificação realtime");
  });
});
