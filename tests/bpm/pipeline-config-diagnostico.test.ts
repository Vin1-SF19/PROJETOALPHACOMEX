import { describe, expect, it } from "vitest";

import {
  analisarDiagnosticoPipeline,
  formatarDiagnosticoPipeline,
  TABELAS_CANONICAS_CONFIG_PIPELINE,
  type SnapshotDiagnosticoPipeline,
} from "../../src/lib/bpm/pipeline-config-diagnostico";

function snapshot(): SnapshotDiagnosticoPipeline {
  return {
    id: "pipeline-1",
    nome: "Revisão de Radar",
    updatedAt: "2026-09-08T12:00:00.000Z",
    etapas: [
      { id: "e1", nome: "Novos leads", ordem: 0, ativo: true, ehInicial: true, ehFinal: false },
      { id: "e2", nome: "Análise", ordem: 1, ativo: true, ehInicial: false, ehFinal: false },
      { id: "e3", nome: "Fechado", ordem: 2, ativo: true, ehInicial: false, ehFinal: true },
    ],
    transicoes: [
      { etapaOrigemId: "e1", etapaDestinoId: "e2", permitida: true },
      { etapaOrigemId: "e1", etapaDestinoId: "e3", permitida: false },
      { etapaOrigemId: "e2", etapaDestinoId: "e1", permitida: false },
      { etapaOrigemId: "e2", etapaDestinoId: "e3", permitida: true },
      { etapaOrigemId: "e3", etapaDestinoId: "e1", permitida: false },
      { etapaOrigemId: "e3", etapaDestinoId: "e2", permitida: false },
    ],
    campos: [
      {
        id: "c1", nome: "Regime tributário", tipo: "selecao", ativo: true,
        fonteEntidade: "CLIENTE", fonteAtributo: "regimeTributario", opcoesJson: null,
        pipelineId: "pipeline-1", opcoes: [], etapaConfiguracoes: [{ etapaId: "e2" }], pipelinesAssociados: [],
      },
      {
        id: "c2", nome: "Radar atual", tipo: "selecao", ativo: true,
        fonteEntidade: null, fonteAtributo: null, opcoesJson: null,
        pipelineId: "outro", opcoes: [], etapaConfiguracoes: [], pipelinesAssociados: [{ pipelineId: "pipeline-1" }],
      },
    ],
    slas: [
      { ativa: true, etapaId: "e2", servicoId: null, tipoProcesso: null, tipoTarefa: null, inicioMomento: "ENTRADA_ETAPA", prioridade: 10 },
      { ativa: true, etapaId: "e2", servicoId: null, tipoProcesso: null, tipoTarefa: null, inicioMomento: "ENTRADA_ETAPA", prioridade: 20 },
    ],
  };
}

describe("diagnóstico da configuração de pipeline", () => {
  it("deriva fluxo, campos compartilhados, sobreposição de SLA e saúde sem dados pessoais", () => {
    const diagnostico = analisarDiagnosticoPipeline(snapshot(), TABELAS_CANONICAS_CONFIG_PIPELINE);
    expect(diagnostico.schema.compativel).toBe(true);
    expect(diagnostico.etapas).toMatchObject({ totalAtivas: 3, iniciais: ["Novos leads"], finais: ["Fechado"], inacessiveis: [] });
    expect(diagnostico.transicoes).toMatchObject({ esperadas: 6, configuradas: 6, permitidas: 2, bloqueadas: 4, ausentes: 0 });
    expect(diagnostico.campos.selecoesAtivasSemFonteOuCatalogo).toEqual(["Radar atual"]);
    expect(diagnostico.campos.compartilhados).toBe(1);
    expect(diagnostico.sla.sobreposicoes).toBe(1);
    expect(diagnostico.saude.status).toBe("ATENCAO");
  });

  it("torna schema ausente crítico e gera saída humana estável", () => {
    const diagnostico = analisarDiagnosticoPipeline(snapshot(), ["BpmSlaConfig"]);
    expect(diagnostico.schema.compativel).toBe(false);
    expect(diagnostico.schema.tabelasAusentes).toContain("BpmCampoEtapaConfig");
    expect(diagnostico.saude.status).toBe("CRITICO");
    expect(formatarDiagnosticoPipeline(diagnostico)).toContain("Schema: incompatível (1/9)");
  });
});
