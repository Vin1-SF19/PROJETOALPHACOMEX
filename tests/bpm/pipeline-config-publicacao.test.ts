import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  resumirAlteracoesPublicacao,
  validarSnapshotPublicacao,
  type CampoAtualPublicacao,
  type EtapaPublicacao,
  type TransicaoPublicacao,
} from "../../src/lib/bpm/pipeline-config-publicacao";

const etapas: EtapaPublicacao[] = [
  { id: "e1", nome: "Entrada", cor: null, ordem: 0, ativo: true, ehInicial: true, ehFinal: false },
  { id: "e2", nome: "Análise", cor: null, ordem: 1, ativo: true, ehInicial: false, ehFinal: false },
  { id: "e3", nome: "Fim", cor: null, ordem: 2, ativo: true, ehInicial: false, ehFinal: true },
];
const transicoes: TransicaoPublicacao[] = [
  { id: "t12", etapaOrigemId: "e1", etapaDestinoId: "e2", permitida: true, origem: "AMBOS" },
  { id: "t13", etapaOrigemId: "e1", etapaDestinoId: "e3", permitida: false, origem: "AMBOS" },
  { id: "t21", etapaOrigemId: "e2", etapaDestinoId: "e1", permitida: false, origem: "AMBOS" },
  { id: "t23", etapaOrigemId: "e2", etapaDestinoId: "e3", permitida: true, origem: "AMBOS" },
  { id: "t31", etapaOrigemId: "e3", etapaDestinoId: "e1", permitida: false, origem: "AMBOS" },
  { id: "t32", etapaOrigemId: "e3", etapaDestinoId: "e2", permitida: false, origem: "AMBOS" },
];
const campos: CampoAtualPublicacao[] = [
  { id: "regime", nome: "Regime tributário", tipo: "selecao", ativo: true, fonteEntidade: "CLIENTE", fonteAtributo: "regimeTributario", opcoesJson: null, opcoes: [] },
  { id: "radar", nome: "Radar atual", tipo: "selecao", ativo: true, fonteEntidade: null, fonteAtributo: null, opcoesJson: null, opcoes: [] },
  { id: "sede", nome: "Status da sede", tipo: "selecao", ativo: true, fonteEntidade: null, fonteAtributo: null, opcoesJson: null, opcoes: [] },
];

describe("publicação versionada da configuração", () => {
  it("aceita as decisões aprovadas e preserva etapas e transições", () => {
    const proposto = {
      etapas: etapas.map((item) => ({ ...item })),
      transicoes: transicoes.map((item) => ({ ...item })),
      campos: campos.map(({ id, ativo }) => ({ id, ativo: id === "regime" ? ativo : false })),
    };
    expect(validarSnapshotPublicacao({ atual: { etapas, transicoes, campos }, proposto })).toEqual([]);
    expect(resumirAlteracoesPublicacao({ atual: { etapas, transicoes, campos }, proposto })).toEqual({
      etapas: [], transicoes: [], campos: ["radar", "sede"], total: 2,
    });
  });

  it("recusa seleção ativa inválida, snapshot parcial e fluxo inalcançável", () => {
    const base = { etapas, transicoes, campos: campos.map(({ id, ativo }) => ({ id, ativo })) };
    expect(validarSnapshotPublicacao({ atual: { etapas, transicoes, campos }, proposto: base }).join(" ")).toContain("Radar atual");
    expect(validarSnapshotPublicacao({ atual: { etapas, transicoes, campos }, proposto: { ...base, campos: base.campos.slice(1) } }).join(" ")).toContain("conjunto atual completo");
    const bloqueadas = transicoes.map((item) => ({ ...item, permitida: false }));
    expect(validarSnapshotPublicacao({ atual: { etapas, transicoes, campos }, proposto: { ...base, transicoes: bloqueadas, campos: base.campos.map((item) => ({ ...item, ativo: item.id === "regime" })) } }).join(" ")).toContain("alcançáveis");
  });

  it("preserva transição publicada para etapa inativa sem reabrir decisão histórica", () => {
    const etapasAtuais = etapas.map((item) => ({ ...item, ativo: item.id === "e2" ? false : item.ativo }));
    const proposto = {
      etapas: etapasAtuais.map((item) => ({ ...item })),
      transicoes: transicoes.map((item) => ({ ...item })),
      campos: campos.map(({ id }) => ({ id, ativo: id === "regime" })),
    };

    expect(validarSnapshotPublicacao({ atual: { etapas: etapasAtuais, transicoes, campos }, proposto }))
      .not.toContain("Transições permitidas só podem conectar etapas ativas.");
  });

  it("rejeita até transição bloqueada que referencie etapa fora do pipeline", () => {
    const proposto = {
      etapas: etapas.map((item) => ({ ...item })),
      transicoes: [
        ...transicoes.map((item) => ({ ...item })),
        { id: "draft-externa", etapaOrigemId: "e1", etapaDestinoId: "etapa-outro-pipeline", permitida: false, origem: "AMBOS" as const },
      ],
      campos: campos.map(({ id }) => ({ id, ativo: id === "regime" })),
    };

    expect(validarSnapshotPublicacao({ atual: { etapas, transicoes, campos }, proposto }))
      .toContain("Toda transição precisa pertencer às etapas do pipeline publicado.");
  });

  it("mantém CAS, autorização transacional, auditoria sanitizada e UX de conflito", () => {
    const action = readFileSync("src/actions/bpm/ConfiguracaoPipeline.ts", "utf8");
    const ui = readFileSync("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx", "utf8");
    expect(action).toContain("configVersion: proposta.baseVersion");
    expect(action).toContain("configVersion: { increment: 1 }");
    expect(action).not.toContain("updatedAt: pipeline.updatedAt");
    expect(action).toContain('campoAlterado: "configuracao_publicada"');
    expect(action).toContain('await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx)');
    expect(action).not.toContain("valorAnteriorJson: JSON.stringify(proposta)");
    expect(ui).toContain("conflitoPublicacao");
    expect(ui).toContain("Aplicar {selecoesAtivasSemCatalogo.length} correção(ões) ao rascunho");
  });
});
