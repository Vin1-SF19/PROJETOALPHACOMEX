import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(arquivo, "utf8");

describe("workspace integral de configuração", () => {
  it("expõe as seis áreas obrigatórias e estados de publicação", () => {
    const ui = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx");
    for (const rotulo of ["Visão geral", "Etapas e fluxo", "Campos e formulários", "SLA", "Permissões", "Histórico"]) {
      expect(ui).toContain(rotulo);
    }
    expect(ui).toContain("Alteração adicionada ao rascunho");
    expect(ui).toContain("Conflito — recarregue");
    expect(ui).toContain("Descartar alterações");
  });

  it("usa simulação read-only do mesmo resolvedor do runtime", () => {
    const action = ler("src/actions/bpm/Sla.ts");
    const runtime = ler("src/lib/bpm/sla.ts");
    const ui = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigSection.tsx");
    expect(runtime).toContain("simularConfiguracaoSlaAplicavel");
    expect(action).toContain("exigirAcessoBpmCard");
    expect(action).toContain("SimularConfiguracaoSlaBpm");
    expect(ui).toContain("Simulação real do runtime");
    expect(ui).toContain("nenhuma instância ou evento é criado");
  });

  it("não serializa valores brutos de auditoria para o browser", () => {
    const pipelineAction = ler("src/actions/bpm/Pipelines.ts");
    const history = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineWorkspaceSections.tsx");
    const bloco = pipelineAction.slice(pipelineAction.indexOf("configAuditoria:"), pipelineAction.indexOf("configAuditoria:") + 350);
    expect(bloco).not.toContain("valorAnteriorJson");
    expect(bloco).not.toContain("valorNovoJson");
    expect(history).not.toContain("resumirValor");
  });
});
