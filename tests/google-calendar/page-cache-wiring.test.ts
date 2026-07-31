import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function ler(...partes: string[]): string {
  return readFileSync(join(process.cwd(), ...partes), "utf8");
}

describe("Agenda Alpha cache e wiring", () => {
  it("não importa nem chama leitura ao vivo de agenda de colega na page SSR", () => {
    const source = ler("src", "app", "PainelAlpha", "CalendarioAlpha", "page.tsx");

    expect(source).not.toContain("listarEventosDeColega");
    expect(source).not.toContain('from "@/actions/google-calendar-colegas"');
    expect(source).toContain("listarEventosCache");
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
      /assinarInvalidacaoCalendarioAlpha\(\(\) => \{[\s\S]*void recarregarCompartilhadasSeAtivo\(\);[\s\S]*router\.refresh\(\)/,
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
