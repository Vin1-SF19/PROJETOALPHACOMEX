import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(arquivo, "utf8");

describe("CRM - configurações centralizadas e card editável", () => {
  it("centraliza módulos administrativos em abas e simplifica a sidebar", () => {
    const tabs = ler(
      "src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx",
    );
    const layout = ler("src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx");

    for (const label of [
      "Automações",
      "Checklists",
      "Base de Conhecimento",
      "Cadências",
    ]) {
      expect(tabs).toContain(label);
    }
    expect(tabs).toContain('<TabsTrigger value="checklists">');
    expect(tabs).toContain('<TabsContent value="checklists">');
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
    expect(admin).not.toContain("Pré-visualização publicada");
    expect(admin).toContain('modo="card"');
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
    expect(builder).toContain("Preview do card");
    expect(builder).toContain("Configuração — ${etapa.nome}");
    expect(builder).toContain("formulario={formularioPreview}");
    expect(builder).toContain("Prévia com alterações ainda não salvas");
    expect(builder).toContain(
      "xl:grid-cols-[220px_minmax(280px,0.8fr)_minmax(320px,1.2fr)]",
    );
    expect(builder).toContain("Salvar card");
    expect(builder).toContain("descartarAlteracoesFormulario");
    expect(builder).toContain("Salve ou descarte as alterações antes de trocar de etapa");
    expect(builder).not.toContain("Etapa exibida");
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
