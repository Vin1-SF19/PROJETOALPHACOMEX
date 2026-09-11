import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raiz = process.cwd();

function ler(caminho: string): string {
  return readFileSync(join(raiz, caminho), "utf8");
}

describe("painel operacional de chamados para TI", () => {
  it("fica à direita das notificações, antes do clima, e exige role TI normalizada", () => {
    const layout = ler("src/components/layout/PainelLayoutClient.tsx");
    const notificacoes = layout.indexOf("<CentralNotificacoesPainel");
    const painel = layout.indexOf("<ChamadosOperacionaisPainel");
    const clima = layout.indexOf("<BibbleWeatherWidget");

    expect(layout).toContain("isSameRole(role, 'TI')");
    expect(notificacoes).toBeGreaterThan(-1);
    expect(painel).toBeGreaterThan(notificacoes);
    expect(clima).toBeGreaterThan(painel);
  });

  it("some sem chamados e reconcilia por foco, evento e intervalo", () => {
    const componente = ler("src/components/chamados/ChamadosOperacionaisPainel.tsx");

    expect(componente).toContain("if (carregandoInicial || chamados.length === 0) return null;");
    expect(componente).toContain('window.addEventListener("focus", atualizar)');
    expect(componente).toContain("CHAMADOS_OPERACIONAIS_ATUALIZAR_EVENT");
    expect(componente).toContain("INTERVALO_RECONCILIACAO_MS");
  });

  it("reutiliza as actions canônicas para assumir, responder e finalizar", () => {
    const componente = ler("src/components/chamados/ChamadosOperacionaisPainel.tsx");

    expect(componente).toContain("assumirChamado(chamadoId)");
    expect(componente).toContain("enviarMensagemChamadoAtendidoTIAction(chamadoId, texto)");
    expect(componente).toContain('updateChamadosStatus(chamadoId, "CONCLUIDO", textoSolucao)');
    expect(componente).toContain('chamado.tecnicoId === usuarioAtualId');
    expect(componente).toContain("onAbrirModulo();");
  });
});
