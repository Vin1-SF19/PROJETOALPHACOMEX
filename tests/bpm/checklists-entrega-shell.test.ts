import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const raiz = process.cwd();

function ler(caminho: string): string {
  return fs.readFileSync(path.join(raiz, caminho), "utf8");
}

describe("autoajuste de entrega do Checklist Builder", () => {
  it("expõe a ação Checklists dentro da configuração existente", () => {
    const admin = ler("src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx");
    const menu = ler("src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx");

    expect(admin).toContain('href="/PainelAlpha/AlphaCRM/admin/checklists"');
    expect(admin).toContain(">Checklists</p>");
    expect(menu).toContain('{ href: "/PainelAlpha/AlphaCRM/admin/checklists", label: "Checklists", icon: ClipboardCheck, exact: false, adminOnly: true }');
    expect(menu.indexOf('label: "Configurações"')).toBeLessThan(menu.indexOf('label: "Checklists"'));
  });

  it("protege o workspace por sessão e papel administrativo", () => {
    const pagina = ler("src/app/PainelAlpha/AlphaCRM/admin/checklists/page.tsx");

    expect(pagina).toContain("const session = await auth()");
    expect(pagina).toContain("if (!session?.user) redirect(\"/\")");
    expect(pagina).toContain("if (!isAdminRole(session.user.role ?? null))");
    expect(pagina).toContain("ListarWorkspaceChecklistsBpm");
    expect(pagina).toContain("<ChecklistsWorkspace");
    expect(pagina).not.toMatch(/@\/lib\/db|prisma/i);
  });

  it("monta uma única instância antecipada do painel operacional no lado esquerdo", () => {
    const slot = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx");
    const historico = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx");
    const painel = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx");

    expect(slot).not.toContain("PainelChecklistsCard");
    expect(historico.match(/<PainelChecklistsCard/g)).toHaveLength(1);
    expect(historico).toContain('<TabsContent value="checklist" forceMount');
    expect(historico).toContain("data-[state=inactive]:hidden");
    expect(painel).toContain("ListarChecklistsCardBpm");
    expect(painel).toContain('role="progressbar"');
    expect(painel).toContain('id="checklist-pendencias"');
    expect(painel).toContain('id={`checklist-item-${item.id}`}');
    expect(painel).toContain("Exclusivo deste card");
    expect(painel).toContain('aria-label={`Responsável por ${item.nome}`}');
    expect(painel).toContain('<option value="">Sem responsável</option>');
    expect(painel).toContain('disabled={!podeEditar || salvando === item.id}');
    expect(painel).toContain('Responsável: ${nomesResponsaveis[0]}');
    expect(painel).not.toContain("Tipo de processo");
    expect(painel).not.toContain("AtualizarCardBpm");
  });

  it("remove Serviço e Tipo de processo do contrato visual do builder", () => {
    const workspace = ler("src/components/bpm/checklists/ChecklistsWorkspace.tsx");
    const schemas = ler("src/lib/bpm/checklists/schemas.ts");

    expect(workspace).not.toMatch(/servico|tipoProcesso|Qualquer serviço|Tipo de processo/);
    expect(schemas).not.toMatch(/servico|tipoProcesso/);
    expect(workspace).toContain("Pipeline");
    expect(workspace).toContain("Etapa");
    expect(workspace).toContain("Card específico");
  });

  it("expõe alerta persistente e navegação acessível para pendências", () => {
    const proximaEtapa = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx");
    const historico = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx");

    expect(proximaEtapa).toContain("ObterResumoChecklistCardBpm");
    expect(proximaEtapa).toContain("Ir para pendências");
    expect(proximaEtapa).toContain('role="alert"');
    expect(historico).toContain("bpm:abrir-pendencias-checklist");
    expect(historico).toContain('setAbaEsquerda("checklist")');
    expect(historico).toContain("scrollIntoView({ behavior: \"smooth\", block: \"center\" })");
    expect(historico).toContain("focus({ preventScroll: true })");
  });
});
