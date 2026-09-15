import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function ler(caminho: string): string {
  return readFileSync(join(process.cwd(), caminho), "utf8");
}

describe("integração visual dos alertas de Último CS", () => {
  it("destaca a data vencida com texto acessível usando a regra compartilhada", () => {
    const pagina = ler("src/app/PainelAlpha/CadastroClientes/page.tsx");

    expect(pagina).toContain("calcularAlertaUltimoCs({ status: c.status");
    expect(pagina).toContain("text-rose-400");
    expect(pagina).toContain('aria-label="Atualização de CS necessária"');
    expect(pagina).toContain(">Atualizar</span>");
  });

  it("troca A-Z/Z-A do status pelos cinco valores canônicos e permite limpar", () => {
    const filtros = ler("src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalFiltros.tsx");
    const dominio = ler("src/lib/cs-nps/alertas-ultimo-cs.ts");
    const pagina = ler("src/app/PainelAlpha/CadastroClientes/page.tsx");

    expect(filtros).toContain("STATUS_CLIENTE_SERVICO.map");
    expect(filtros).toContain("setFiltroStatus(null)");
    expect(filtros).not.toContain('{ label: "Status", campo: "status"');
    for (const status of ["Em Andamento", "Deferido", "Stand By", "Cancelado - Indeferimento", "Cancelado - Troca de Empresa"]) {
      expect(dominio).toContain(`"${status}"`);
    }
    expect(pagina).toContain("if (filtroStatus && c.status !== filtroStatus) return false");
    expect(pagina).toContain("ordenacao, filtroStatus");
  });

  it("integra um alerta agregado ao sino sem remover as fontes existentes", () => {
    const central = ler("src/components/layout/CentralNotificacoesPainel.tsx");

    expect(central).toContain("useCsNpsNotificacoes");
    expect(central).toContain('origem: "CS & NPS"');
    expect(central).toContain('id: "cs-nps-ultimo-cs"');
    expect(central).toContain("csNps.pendencias.length");
    expect(central).toContain("abrir: csNps.abrirModal");
    for (const fonte of ["calendario.notificacoes", "chamados.notificacoes", "checklist.notificacoes", "notas.notificacoes", "holerite.alertaAtivo"]) {
      expect(central).toContain(fonte);
    }
  });

  it("monta no shell a sequência lista → Novo CS → lista e reconcilia após sucesso", () => {
    const layout = ler("src/components/layout/PainelLayoutClient.tsx");
    const modal = ler("src/components/cs-nps/CsNpsPendenciasModal.tsx");

    expect(layout).toContain("useCsNpsNotifications(role)");
    expect(layout).toContain("<CsNpsPendenciasModal onReconciliar={reconciliarAlertasCs}");
    expect(modal).toContain("setSelecionada(pendencia)");
    expect(modal).toContain("setSelecionada(null)");
    expect(modal).toContain("await onReconciliar()");
    expect(modal).toContain("salvarLogCSPorAlerta(pendencia.clienteServicoId");
    expect(modal).toContain("Não foi possível atualizar o CS");
    expect(modal).toContain('role="dialog" aria-modal="true"');
  });

  it("reconcilia na carga, no foco e durante a sessão sem sobrepor consultas", () => {
    const hook = ler("src/hooks/useCsNpsNotifications.ts");

    expect(hook).toContain("consultaEmAndamentoRef.current");
    expect(hook).toContain('window.addEventListener("focus"');
    expect(hook).toContain('document.addEventListener("visibilitychange"');
    expect(hook).toContain("window.setInterval");
    expect(hook).toContain("window.clearInterval");
  });
});
