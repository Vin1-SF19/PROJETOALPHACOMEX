import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raiz = process.cwd();

function ler(caminho: string): string {
  return readFileSync(join(raiz, caminho), "utf8");
}

describe("tarefa de chamado na agenda do solicitante", () => {
  it("bloqueia conclusão e edição fora da agenda do técnico", () => {
    const dashboard = ler(
      "src/components/CalendarioAlpha/CalendarioAlphaDashboard.tsx",
    );
    const controller = ler(
      "src/components/CalendarioAlpha/lib/useAgendaAlphaController.ts",
    );

    expect(dashboard).toContain("if (!tarefa.calendarioGravavel)");
    expect(controller).toContain("if (!evento.calendarioGravavel)");
    expect(dashboard).toContain("é somente leitura");
    expect(controller).toContain("é somente leitura");
  });

  it("identifica visualmente tarefas pendentes somente leitura em todas as visões", () => {
    for (const arquivo of [
      "src/components/CalendarioAlpha/GradeHoraria.tsx",
      "src/components/CalendarioAlpha/VisaoMes.tsx",
      "src/components/CalendarioAlpha/DiaEventosPopover.tsx",
    ]) {
      const fonte = ler(arquivo);
      expect(fonte).toContain("!evento.calendarioGravavel");
      expect(fonte).toContain("Tarefa do chamado — somente leitura");
    }
  });

  it("revalida a agenda aberta ao receber a mudança do chamado em tempo real", () => {
    const hook = ler("src/hooks/useCalendarioAlphaNotifications.ts");
    const notificacoes = ler("src/lib/google-calendar/notificacoes.ts");

    expect(notificacoes).toContain("CALENDARIO_ALPHA_CHAMADO_ATUALIZADO_EVENT");
    expect(hook).toContain(
      "canal.bind(CALENDARIO_ALPHA_CHAMADO_ATUALIZADO_EVENT, handlerChamadoAtualizado)",
    );
    expect(hook).toContain("notificarCalendarioAlphaAlterado()");
  });
});
