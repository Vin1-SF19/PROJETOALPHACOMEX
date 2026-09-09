import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const ler = (arquivo: string) => readFileSync(path.join(root, arquivo), "utf8");

describe("P0-1 — fontes canônicas do CRM/BPM", () => {
  it("runtime de transição usa exclusivamente BpmTransicaoEtapa", () => {
    const cards = ler("src/actions/bpm/Cards.ts");
    const command = ler("src/lib/bpm/transicao-command.ts");
    expect(cards).not.toContain("bpmEtapaTransicaoPermitida");
    expect(command).toContain("bpmTransicaoEtapa.findUnique");
    expect(command).not.toContain("bpmEtapaTransicaoPermitida");
  });

  it("comportamento por etapa não possui fallback para atributos do campo", () => {
    const source = ler("src/lib/bpm/requisitos-etapa-server.ts");
    expect(source).toContain("etapaConfiguracoes: { some: { etapaId } }");
    expect(source).toContain("obrigatorio: configEtapa?.obrigatorio === true");
    expect(source).not.toContain("configEtapa?.obrigatorio ?? campo.obrigatorio");
    expect(source).not.toContain("bpmCampoObrigatorioEtapa");
    expect(source).not.toContain("bpmCampoOcultoEtapa");
  });

  it("Lost e Central de Pendências consultam BpmCampoEtapaConfig", () => {
    expect(ler("src/actions/bpm/Cards.ts")).toContain("etapaConfiguracoes: { some: { etapaId: params.etapaLostId");
    const pendencias = ler("src/lib/bpm/pendencias/motor.ts");
    expect(pendencias).toContain("client.bpmCampoEtapaConfig.findMany");
    expect(pendencias).not.toContain("obrigatorio: true },");
  });

  it("associação ao pipeline não concede presença em uma etapa", () => {
    const source = ler("src/lib/bpm/requisitos-etapa-server.ts");
    expect(source).toContain("etapaConfiguracoes: { some: { etapaId } }");
    expect(source).toContain("pipelinesAssociados: { some: { pipelineId } }");
  });

  it("administração e resumo histórico não usam atributos campo-etapa legados", () => {
    const schemas = ler("src/lib/validations/bpm.ts");
    const admin = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx");
    const resumo = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelResumoEtapas.tsx");
    expect(schemas).not.toContain("etapaId: z.string().cuid().nullable().optional()");
    expect(admin).not.toContain("etapaId: null,\n      obrigatorio: false");
    expect(resumo).toContain("campo.etapaConfiguracoes.some");
    expect(resumo).not.toContain("campo.etapaId === etapa.id");
  });

  it("runtime e administração de SLA não leem nem escrevem slaDias", () => {
    for (const arquivo of [
      "src/actions/bpm/Etapas.ts",
      "src/lib/validations/bpm.ts",
      "src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx",
    ]) expect(ler(arquivo)).not.toContain("slaDias");
    expect(ler("src/lib/bpm/sla.ts")).toContain("bpmSlaConfig");
  });

  it("cadência usa somente a relação multietapas", () => {
    const actions = ler("src/actions/bpm/Cadencias.ts");
    const runtime = ler("src/lib/bpm/cadencias/ativacao-automatica.ts");
    expect(actions).not.toContain("atualizarShadowLegado");
    expect(actions).not.toContain("atual.etapaId");
    expect(runtime).toContain("etapas: { some:");
    expect(runtime).toContain("etapas: { none: {} }");
    expect(runtime).not.toContain("etapaId: null, etapas");
  });

  it("requisitos de campo são derivados da configuração canônica", () => {
    const command = ler("src/lib/bpm/transicao-command.ts");
    expect(command).toContain("campoId: null");
    expect(command).toContain("config.obrigatorioSaida");
    expect(command).toContain("config.obrigatorioEntrada");
    expect(command).toContain("config.condicaoObrigatoriedadeJson");
  });

  it("migração é dry-run por padrão e exige confirmação para escrita", () => {
    const migration = ler("scripts/bpm-migrate-canonical-sources.mjs");
    expect(migration).toContain('const mode = process.argv.includes("--apply") ? "apply" : "dry-run"');
    expect(migration).toContain('confirmation !== "P0-1-CANONICAL-SOURCES"');
    expect(migration).toContain("await tx.rollback()");
  });
});
