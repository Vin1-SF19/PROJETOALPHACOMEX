import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STATUS_POS_FECHAMENTO_OPCOES } from "@/lib/bpm/status-pos-fechamento";

const raiz = process.cwd();
const board = readFileSync(
  resolve(raiz, "src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx"),
  "utf8",
);

describe("CRM Fechado - representacao no board", () => {
  it("mantem as cinco opcoes compartilhadas na ordem operacional", () => {
    expect(STATUS_POS_FECHAMENTO_OPCOES.map(({ label }) => label)).toEqual([
      "Aguardando contrato",
      "Contrato a enviar",
      "Contrato enviado",
      "Pagamento confirmado",
      "Contrato assinado",
    ]);
    expect(new Set(STATUS_POS_FECHAMENTO_OPCOES.map(({ badgeClassName }) => badgeClassName)).size).toBe(5);
    expect(new Set(STATUS_POS_FECHAMENTO_OPCOES.map(({ cardClassName }) => cardClassName)).size).toBe(5);
  });

  it("deriva badge e container da mesma configuracao visivel somente em Fechado", () => {
    expect(board).toContain("obterStatusPosFechamentoVisivel({ etapaNome, status: card.statusPosFechamento })");
    expect(board).toContain("statusConfig?.cardClassName");
    expect(board).toContain("statusConfig.badgeClassName");
    expect(board).not.toContain("const STATUS_POS_FECHAMENTO_CONFIG");
  });

  it("preserva os estados de nunca acessado, drag, hover e comunicacao textual", () => {
    expect(board).toContain("isDragging ? 0.4 : 1");
    expect(board).toContain("border-cyan-400/50 hover:border-cyan-400/70");
    expect(board).toContain('title="Nunca acessado"');
    expect(board).toContain("`${nomeEmpresa}. Status pós-fechamento: ${statusConfig.label}`");
    expect(board).toContain(": nomeEmpresa}");
    expect(board.indexOf("{...attributes}")).toBeLessThan(board.indexOf("aria-label={statusConfig"));
    expect(board.indexOf("{...listeners}")).toBeLessThan(board.indexOf("aria-label={statusConfig"));
    expect(board).toContain("statusConfig.label");
  });
});
