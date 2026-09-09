import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function ler(...partes: string[]): string {
  return readFileSync(join(process.cwd(), ...partes), "utf8");
}

describe("Agenda Alpha cache e wiring", () => {
  it("mantém a data da URL como data civil local na entrada e na navegação", () => {
    const page = ler("src", "app", "PainelAlpha", "CalendarioAlpha", "page.tsx");
    const controller = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "lib",
      "useAgendaAlphaController.ts",
    );

    expect(page).toContain("parsearDataCivil(dataParam)");
    expect(page).not.toContain("new Date(dataParam)");
    expect(controller).toContain("data: formatarDataCivil(novaData)");
    expect(controller).not.toContain("novaData.toISOString().slice(0, 10)");
  });

  it("entrega o shell sem bloquear o SSR na leitura dos eventos", () => {
    const source = ler("src", "app", "PainelAlpha", "CalendarioAlpha", "page.tsx");

    expect(source).not.toContain("listarEventosDeColega");
    expect(source).not.toContain('from "@/actions/google-calendar-colegas"');
    expect(source).not.toContain("listarEventosCache");
    expect(source).not.toContain("googleCalendarEventoCache.findMany");
  });

  it("troca a visão localmente e revalida o snapshot sem navegar pelo servidor", () => {
    const controller = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "lib",
      "useAgendaAlphaController.ts",
    );

    expect(controller).toContain("window.history.pushState");
    expect(controller).toContain("carregarIntervaloAgendaAlpha");
    expect(controller).toContain("lerSnapshotAgenda");
    expect(controller).not.toContain("router.push(`/PainelAlpha/CalendarioAlpha?");
  });

  it("cria eventos e tarefas otimisticamente e reconcilia com o backend", () => {
    const formulario = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "FormularioEvento.tsx",
    );
    const controller = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "lib",
      "useAgendaAlphaController.ts",
    );

    expect(formulario).toContain("onSalvarOtimista({");
    expect(formulario).toContain("sincronizacaoPendente: true");
    expect(controller).toContain("setItensOtimistas");
    expect(controller).toContain("itensOtimistasConfirmados.current.add");
    expect(controller).toContain("await recarregarPeriodoAtual(true)");
  });

  it("só ativa compartilhadas por ação explícita e recarrega se já estiverem ativas", () => {
    const dashboard = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "CalendarioAlphaDashboard.tsx",
    );
    const controller = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "lib",
      "useAgendaAlphaController.ts",
    );
    const hook = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "lib",
      "useAgendasCompartilhadas.ts",
    );

    expect(hook).not.toContain("ativarAposMontagem");
    expect(hook).toContain("recarregarSeAtivo");
    expect(dashboard).not.toContain("ativarCompartilhadasAposMontagem");
    expect(controller).toContain("await compartilhadas.carregar()");
    expect(controller).toContain("void compartilhadas.carregar()");
    expect(controller).toMatch(
      /assinarInvalidacaoCalendarioAlpha\(\(\) => \{[\s\S]*void recarregarCompartilhadasSeAtivo\(\);[\s\S]*void recarregarPeriodoAtual\(true\)/,
    );
  });

  it("descarta hidratação stale e entrega evento/detalhes como sessão atômica", () => {
    const dashboard = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "CalendarioAlphaDashboard.tsx",
    );
    const controller = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "lib",
      "useAgendaAlphaController.ts",
    );

    expect(controller).toContain("const sequenciaEdicao = useRef(0)");
    expect(controller).toContain("solicitacaoEdicaoAindaAtiva(sequencia, chave)");
    expect(controller).toContain("setSessaoEdicao({ evento, detalhes: resultado.data })");
    expect(dashboard).toContain("evento={agenda.sessaoEdicao?.evento}");
    expect(dashboard).toContain("detalhesEvento={agenda.sessaoEdicao?.detalhes}");
    expect(dashboard.split(/\r?\n/).length).toBeLessThanOrEqual(300);
  });

  it("não usa transição de navegação como estado visual do sync manual", () => {
    const dashboard = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "CalendarioAlphaDashboard.tsx",
    );
    const controller = ler(
      "src",
      "components",
      "CalendarioAlpha",
      "lib",
      "useAgendaAlphaController.ts",
    );

    expect(dashboard).toContain("sincronizando={agenda.sincronizando}");
    expect(dashboard).not.toContain("sincronizando={isPending}");
    expect(controller).toContain(
      "const [sincronizando, setSincronizando] = useState(false)",
    );
  });
});
