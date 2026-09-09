import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raiz = process.cwd();

function ler(caminho: string): string {
  return readFileSync(join(raiz, caminho), "utf8");
}

describe("central geral de notificações do Painel Alpha", () => {
  it("agrega todos os stores globais existentes no sino do shell", () => {
    const central = ler("src/components/layout/CentralNotificacoesPainel.tsx");

    for (const store of [
      "useCalendarioAlphaNotificacoes",
      "useChamadoNotificacoes",
      "useChecklistNotificacoes",
      "useNotasNotificacoes",
      "useHoleriteNotificacoes",
    ]) {
      expect(central).toContain(store);
    }
    expect(central).toContain('title="Notificações"');
    expect(central).toContain('>Notificações</span>');
    expect(central).toContain(".sort((a, b)");
  });

  it("fica disponível para qualquer usuário no shell e abre módulos por abas internas", () => {
    const layout = ler("src/components/layout/PainelLayoutClient.tsx");
    const central = ler("src/components/layout/CentralNotificacoesPainel.tsx");
    const toastChamados = ler("src/components/chamados/NotificationToast.tsx");

    expect(layout).toContain("<CentralNotificacoesPainel");
    expect(layout).toContain("onAbrirModulo={openTab}");
    expect(layout).not.toContain("temAcessoCalendarioAlpha && <CentralNotificacoesPainel");
    expect(central).toContain('onAbrirModulo("/PainelAlpha/Chamados", "Chamados")');
    expect(toastChamados).toContain("onAbrirChamados()");
    expect(toastChamados).not.toContain("router.push");
  });

  it("assina e apresenta o aviso instantâneo de chamado assumido", () => {
    const hook = ler("src/hooks/useAdminChamadosNotifications.ts");
    const contrato = ler("src/lib/chamados/notificacoes.ts");

    expect(contrato).toContain('CHAMADO_ASSUMIDO_EVENT = "chamado-assumido"');
    expect(hook).toContain("userChannel.bind(CHAMADO_ASSUMIDO_EVENT, assumidoHandler)");
    expect(hook).toContain("assumiu seu chamado e já está resolvendo o problema");
    expect(hook).toContain("userChannel.unbind(CHAMADO_ASSUMIDO_EVENT, assumidoHandler)");
  });

  it("leva novas mensagens legadas de chamados para a central em vez de navegar por router", () => {
    const polling = ler("src/components/NotificacaoFlutuante.tsx");
    const toastChamados = ler("src/components/chamados/NotificationToast.tsx");

    expect(polling).toContain("adicionarNotificacao({");
    expect(polling).toContain('urgencia: "MENSAGEM"');
    expect(polling).toContain("primeiraCarga.current = false");
    expect(polling).not.toContain("router.push");
    expect(toastChamados).toContain("Nova mensagem no chamado");
  });
});
