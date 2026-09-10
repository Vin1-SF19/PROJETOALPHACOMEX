import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(arquivo, "utf8");

describe("CRM - configurações centralizadas e card editável", () => {
  it("centraliza módulos administrativos em abas e simplifica a sidebar", () => {
    const tabs = ler("src/app/PainelAlpha/AlphaCRM/admin/AdminConfigTabs.tsx");
    const layout = ler("src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx");

    for (const [label, rota] of [
      ["Pipelines", "/PainelAlpha/AlphaCRM/admin"],
      ["Automações", "/PainelAlpha/AlphaCRM/admin/automacoes"],
      ["Checklists", "/PainelAlpha/AlphaCRM/admin/checklists"],
      ["Base de Conhecimento", "/PainelAlpha/AlphaCRM/admin/conhecimento"],
      ["Cadências", "/PainelAlpha/AlphaCRM/admin/cadencias"],
    ]) {
      expect(tabs).toContain(`label: "${label}"`);
      expect(tabs).toContain(`href: "${rota}"`);
    }
    expect(layout).toContain('label: "Configurações"');
    expect(layout).not.toContain('label: "Automações"');
    expect(layout).not.toContain('label: "Checklists"');
    expect(layout).not.toContain('label: "Base de Conhecimento"');
    expect(layout).not.toContain('label: "Cadências"');
  });

  it("preserva a URL antiga de automações por redirecionamento", () => {
    const antiga = ler("src/app/PainelAlpha/AlphaCRM/automacoes/page.tsx");
    const nova = ler("src/app/PainelAlpha/AlphaCRM/admin/automacoes/page.tsx");

    expect(antiga).toContain(
      'redirect("/PainelAlpha/AlphaCRM/admin/automacoes")',
    );
    expect(nova).toContain("<AutomacoesWorkspace");
    expect(nova).toContain("<MotorCentralPanel");
    expect(nova).toContain("isAdminRole");
  });

  it("remove o editor concorrente de campos e mantém o formulário canônico", () => {
    const admin = ler(
      "src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx",
    );

    expect(admin).not.toContain("Campos Personalizados");
    expect(admin).not.toContain("Campos aplicáveis nesta etapa");
    expect(admin).not.toContain("Criar e publicar campo");
    expect(admin).toContain("<FormularioEtapaWorkspace");
    expect(admin).toContain("Pré-visualização publicada");
  });

  it("oferece edição, exclusão, ordem e movimento entre seções", () => {
    const builder = ler(
      "src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx",
    );

    expect(builder).toContain("Título da seção");
    expect(builder).toContain("Rótulo de ${");
    expect(builder).toContain("moverComponenteParaSecao");
    expect(builder).toContain("Mover componente para outra seção");
    expect(builder).toContain("Remover componente da apresentação");
    expect(builder).toContain("Publicar composição");
  });

  it("remove somente a simulação visual de SLA", () => {
    const sla = ler(
      "src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigSection.tsx",
    );

    expect(sla).not.toContain("Simulação real do runtime");
    expect(sla).not.toContain("SimularConfiguracaoSlaBpm");
    expect(sla).toContain("SalvarConfiguracaoSlaBpm");
    expect(sla).toContain("ExcluirConfiguracaoSlaBpm");
    expect(sla).toContain("AtivarDesativarConfiguracaoSlaBpm");
  });
});
