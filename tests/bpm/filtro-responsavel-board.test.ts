import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const board = readFileSync(
  "src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx",
  "utf8",
);

describe("filtro por responsável do board (RM-2026-70EFE1)", () => {
  it("fica ao lado da atualização e oferece a opção de exibir todos", () => {
    expect(board).toContain('aria-label="Filtrar cards por responsável"');
    expect(board).toContain('<SelectItem value="todos">Todos os responsáveis</SelectItem>');
    expect(board.indexOf('aria-label="Filtrar cards por responsável"')).toBeLessThan(
      board.indexOf('aria-label="Atualizar pipeline"'),
    );
  });

  it("inclui e filtra tanto o responsável principal quanto os membros do card", () => {
    expect(board).toContain("mapa.set(card.responsavel.id, card.responsavel.nome)");
    expect(board).toContain("String(c.responsavel.id) === responsavelFiltro");
    expect(board).toContain(
      "c.membros.some((m) => String(m.usuario.id) === responsavelFiltro)",
    );
  });
});
