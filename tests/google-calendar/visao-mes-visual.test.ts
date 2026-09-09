import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const fonte = readFileSync(
  join(process.cwd(), "src/components/CalendarioAlpha/VisaoMes.tsx"),
  "utf8",
);

describe("visão mensal da Agenda Alpha", () => {
  it("reproduz a hierarquia compacta da referência visual", () => {
    expect(fonte).toContain('const LIMITE_EVENTOS_VISIVEIS = 2');
    expect(fonte).toContain('const primeiraSemana = indice < 7');
    expect(fonte).toContain('gridTemplateRows: `repeat(${numeroSemanas}');
    expect(fonte).toContain('Mais {eventosDoDia.length - LIMITE_EVENTOS_VISIVEIS}');
  });

  it("diferencia local de trabalho, evento com horário, dia inteiro e tarefa concluída", () => {
    expect(fonte).toContain('evento.eventType === "workingLocation"');
    expect(fonte).toContain("formatarHoraCompacta");
    expect(fonte).toContain("evento.diaInteiro");
    expect(fonte).toContain("FUNDO_TAREFA_CONCLUIDA");
    expect(fonte).toContain('concluida && "line-through');
  });

  it("preserva ações e navegação acessíveis", () => {
    expect(fonte).toContain('role="grid"');
    expect(fonte).toContain('role="gridcell"');
    expect(fonte).toContain("onNovoEventoNoDia(dia)");
    expect(fonte).toContain("onConcluirTarefa(evento.tarefaCacheId)");
    expect(fonte).toContain("onEditarEvento(evento)");
    expect(fonte).toContain("<DiaEventosPopover");
  });

  it("usa o mesmo fundo translúcido das visões de dia e semana", () => {
    const gradeHoraria = readFileSync(
      join(process.cwd(), "src/components/CalendarioAlpha/GradeHoraria.tsx"),
      "utf8",
    );
    const fundoCompartilhado = "bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))]";

    expect(fonte).toContain(fundoCompartilhado);
    expect(gradeHoraria).toContain(fundoCompartilhado);
    expect(fonte).not.toContain("bg-[#111315]");
  });
});
