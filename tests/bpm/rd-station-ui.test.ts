import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/actions/bpm/RdStationHistorico", () => ({ ListarHistoricoExternoRd: vi.fn(), CorrigirHistoricoExternoRd: vi.fn() }));
import { EventoHistoricoRdItem } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoRd";

describe("histórico RD para o usuário", () => {
  it("exibe etapa, período e ajustes legíveis, sem JSON/identificadores", () => {
    const html = renderToStaticMarkup(createElement(EventoHistoricoRdItem, {
      evento: {
        id: "private-event-id", tipo: "DEAL_STAGE_HISTORY", data: "2025-09-28T08:45:35.880-03:00",
        projecao: { title: "RevisÃ£o", content: "emprÃ©stimo aprovado", sourceStageName: "Revisão", sourceStageId: "private-stage-id" },
        periodoOriginal: { entrada: "2025-09-28T08:45:35.880-03:00", saida: "2025-09-29T14:16:01.472-03:00" },
        correcoes: [{ versao: 1, campos: { title: true }, anterior: { title: "Anterior", sourceStageId: "private-stage-id" }, nova: { title: "RevisÃ£o", sourceStageId: "private-stage-id" }, autor: "Operador", data: new Date("2026-01-01T12:00:00Z") }],
      }, podeEditar: true, onAtualizado: vi.fn(),
    }));
    expect(html).toContain("Revisão"); expect(html).toContain("empréstimo aprovado");
    expect(html).toContain("Entrada na etapa no RD"); expect(html).toContain("28/09/2025"); expect(html).toContain("08:45");
    expect(html).toContain("Saída da etapa no RD"); expect(html).toContain("29/09/2025"); expect(html).toContain("14:16");
    expect(html).toContain("Histórico de ajustes"); expect(html).toContain("Antes:");
    for (const technical of ["Payload", "sourceStageId", "private-stage-id", "private-event-id", "<pre", "emprÃ"]) expect(html).not.toContain(technical);
  });
});
