import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  checklistNoDiaDaReuniao, planilhaChecklistValida, prazoEnvioChecklist,
} from "@/lib/bpm/checklist-envio-operacional";
import { PainelEnvioChecklistOperacional } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelEnvioChecklistOperacional";

describe("Envio do checklist atualizado", () => {
  it("aceita somente Excel com extensão e tipo coerentes", () => {
    expect(planilhaChecklistValida("checklist.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(planilhaChecklistValida("checklist.xls", "application/vnd.ms-excel")).toBe(true);
    expect(planilhaChecklistValida("checklist.pdf", "application/pdf")).toBe(false);
    expect(planilhaChecklistValida("checklist.xlsx", "application/pdf")).toBe(false);
  });

  it("usa o último instante do dia civil da reunião em São Paulo", () => {
    const reuniao = new Date("2026-09-29T23:30:00.000Z");
    expect(prazoEnvioChecklist(reuniao)?.toISOString()).toBe("2026-09-30T02:59:59.999Z");
    expect(checklistNoDiaDaReuniao(reuniao, new Date("2026-09-30T02:50:00.000Z"))).toBe(true);
    expect(checklistNoDiaDaReuniao(reuniao, new Date("2026-09-30T03:00:00.000Z"))).toBe(false);
  });

  it("exibe prazo e link do Excel sem declarar cumprimento quando não há data da reunião", () => {
    const html = renderToStaticMarkup(createElement(PainelEnvioChecklistOperacional, {
      dataReuniao: null,
      anexo: { nome: "checklist.xlsx", url: "/api/bpm/anexos/arquivo", createdAt: "2026-09-29T18:00:00.000Z" },
      tarefa: { status: "CONCLUIDA", prazo: null },
    }));
    expect(html).toContain("checklist.xlsx");
    expect(html).toContain("/api/bpm/anexos/arquivo");
    expect(html).toContain("Prazo sem data da reunião para comparar");
    expect(html).not.toContain("No dia da reunião.");
  });
});
