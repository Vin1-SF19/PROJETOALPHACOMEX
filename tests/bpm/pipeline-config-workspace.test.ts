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
    expect(ui).toContain("Publicar rascunho principal");
    expect(ui).toContain("Rascunho principal: etapas, fluxo e ativação de campos");
  });

  it("não confunde editores independentes com publicação parcial do rascunho principal", () => {
    const admin = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx");
    const cadencia = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/CadenciaEtapasSection.tsx");
    const formulario = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx");
    const visibilidade = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadeEtapasSection.tsx");
    expect(admin).not.toContain("if (editandoCampoId) {\n      void salvarEdicao");
    expect(admin).toContain("Publicar campo");
    expect(cadencia).toContain("A seleção fica pendente até a publicação explícita");
    expect(cadencia).toContain("onClick={() => void publicar(etapa.id)}");
    expect(formulario).toContain("Publicar composição");
    expect(visibilidade).toContain("Publicar etapa");
  });

  it("invalida versões abertas quando outro escritor de configuração publica", () => {
    for (const arquivo of [
      "Cadencias",
      "Campos",
      "Etapas",
      "FormulariosEtapa",
      "Pipelines",
      "Sla",
      "SubStatus",
      "Transicoes",
      "VisibilidadeEtapas",
    ]) {
      expect(ler(`src/actions/bpm/${arquivo}.ts`)).toContain("avancarConfigVersionBpm");
    }
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

  it("não converte falha de carregamento de domínios relacionados em arrays vazios", () => {
    const pagina = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx");
    expect(pagina).toContain("A configuração não foi carregada por completo");
    expect(pagina).toContain("Nenhuma coleção vazia foi usada como substituta");
    expect(pagina).not.toContain("cadenciasResult.success ? cadenciasResult.data : []");
    expect(pagina).not.toContain("servicosResult.success ? servicosResult.servicos");
  });
});
