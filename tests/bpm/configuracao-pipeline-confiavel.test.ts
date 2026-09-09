import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(arquivo, "utf8");

describe("configuração funcional do pipeline", () => {
  it("mantém rascunho separado do estado confirmado e restaura falhas", () => {
    const admin = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx");
    const visibilidade = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadeEtapasSection.tsx");
    expect(admin).toContain("etapasConfirmadas");
    expect(admin).toContain("setEtapas(anteriores)");
    expect(admin).toContain("etapaConfirmadaSelecionada");
    expect(admin).toContain("onClick={descartarEtapa}");
    expect(admin).toContain("handleSalvarEtapa");
    expect(admin).not.toContain("handleAlterarCorEtapa");
    expect(visibilidade).toContain("regrasConfirmadas");
    expect(visibilidade).toContain("[etapaId]: regrasConfirmadas[etapaId] ?? {}");
  });

  it("representa transição ausente como não configurada e fail-closed", () => {
    const ui = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/EtapaAvancadaSection.tsx");
    const runtime = ler("src/lib/bpm/requisitos-etapa-server.ts");
    expect(ui).toContain("const permitida = transicao?.permitida === true");
    expect(ui).toContain('"Não configurada"');
    expect(ui).toContain("Ausência de regra explícita bloqueia a transição no runtime");
    expect(runtime).toContain('return { permitida: false, motivo: "Esta transição não está definida no pipeline." }');
  });

  it("usa configuração por etapa no admin e no runtime, sem editor de SLA legado", () => {
    const admin = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx");
    const runtime = ler("src/lib/bpm/requisitos-etapa-server.ts");
    expect(runtime).toContain("etapaConfiguracoes: { some: { etapaId } }");
    expect(runtime).not.toContain('{ pipelineId, OR: [{ etapaId }, { etapaId: null }] }');
    expect(admin).toContain('<TabsTrigger value="sla">');
    expect(admin).toContain("<SlaConfigSection");
    expect(admin).not.toContain("handleAtualizarSla");
    expect(admin).not.toContain("SLA (dias)");
  });

  it("exibe seleção canônica como valor somente leitura, sem select vazio", () => {
    const input = ler("src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx");
    expect(input).toContain("&& campo.fonteEntidade");
    expect(input).toContain('aria-readonly="true"');
    expect(input.indexOf("&& campo.fonteEntidade")).toBeLessThan(input.indexOf('if (campo.tipo === "selecao" || campo.tipo === "booleano")'));
  });

  it("grava auditoria com o mesmo cliente transacional da mutação", () => {
    for (const arquivo of ["Etapas", "Transicoes", "SubStatus"] as const) {
      const action = ler(`src/actions/bpm/${arquivo}.ts`);
      expect(action).not.toContain("db.bpmPipelineConfigAuditoria.create");
    }
    expect(ler("src/actions/bpm/Etapas.ts")).toContain("registrarAuditoriaPipeline(tx,");
  });

  it("não altera configuração em GET e converte o preset financeiro para contratos canônicos", () => {
    const paginaAdmin = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx");
    const paginaBoard = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx");
    const financeiro = ler("src/actions/bpm/PipelineFinanceiro.ts");
    expect(paginaAdmin).not.toContain("garantirSchemaFinanceiro");
    expect(paginaBoard).not.toContain("garantirSchemaFinanceiro");
    expect(financeiro).toContain("tx.bpmCampoEtapaConfig.upsert");
    expect(financeiro).toContain("tx.bpmTransicaoEtapa.upsert");
  });
});
