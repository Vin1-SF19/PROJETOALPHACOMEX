import { describe, expect, it } from "vitest";
import {
  followUpBloqueiaFechamento,
  montarPayloadCamposDestino,
  resolverSnapshotCamposRealtime,
  separarCamposRequisitos,
} from "@/lib/bpm/card-modal-ui";

describe("CRM - fechamento do card com follow-up", () => {
  it.each(["CARREGANDO", "ERRO", "EM_ANDAMENTO"] as const)("bloqueia Em Tratativa no estado %s", (estado) => {
    expect(followUpBloqueiaFechamento("Em Tratativa", estado)).toBe(true);
  });

  it.each(["NAO_INICIADO", "CONCLUIDO"] as const)("libera quando o backend confirma %s", (estado) => {
    expect(followUpBloqueiaFechamento("Em Tratativa", estado)).toBe(false);
  });

  it("aplica o bloqueio também a participante somente leitura", () => {
    expect(followUpBloqueiaFechamento("Em Tratativa", "EM_ANDAMENTO")).toBe(true);
  });

  it("não interfere em outras etapas", () => {
    expect(followUpBloqueiaFechamento("Agendar Reunião", "CARREGANDO")).toBe(false);
  });
});

describe("CRM - requisitos sem duplicar campos da origem", () => {
  const campos = [
    { id: "origem", contexto: "ORIGEM" as const },
    { id: "associado-atual", contexto: "AMBOS" as const },
    { id: "destino", contexto: "DESTINO" as const },
  ];

  it("separa campos já editáveis na etapa atual dos campos do destino", () => {
    const resultado = separarCamposRequisitos(campos, new Set(["origem", "associado-atual"]));
    expect(resultado.origem.map((campo) => campo.id)).toEqual(["origem", "associado-atual"]);
    expect(resultado.editaveisDestino.map((campo) => campo.id)).toEqual(["destino"]);
  });

  it("envia somente campos exibidos do destino e não sobrescreve origem persistida", () => {
    const { editaveisDestino } = separarCamposRequisitos(campos, new Set(["origem", "associado-atual"]));
    const payload = montarPayloadCamposDestino(editaveisDestino, {
      origem: "snapshot-antigo",
      "associado-atual": "snapshot-antigo",
      destino: "valor-novo",
    });
    expect(payload).toEqual({ destino: "valor-novo" });
  });
});

describe("CRM - snapshot e versao dos campos diante de realtime", () => {
  const atual = { valores: { motivo: "Outro", complemento: "rascunho" }, versao: "v1" };
  const remoto = { valores: { motivo: "Sem resposta", complemento: "" }, versao: "v2" };

  it("congela valores e versao-base enquanto existe rascunho sujo", () => {
    const resultado = resolverSnapshotCamposRealtime({
      rascunhoSujo: true,
      snapshotAtual: atual,
      snapshotRemoto: remoto,
    });

    expect(resultado.aplicarRemoto).toBe(false);
    expect(resultado.snapshotAtivo).toBe(atual);
    expect(resultado.snapshotPendente).toBe(remoto);
  });

  it("aplica valores e versao remotos juntos quando o formulario esta limpo", () => {
    const resultado = resolverSnapshotCamposRealtime({
      rascunhoSujo: false,
      snapshotAtual: atual,
      snapshotRemoto: remoto,
    });

    expect(resultado.aplicarRemoto).toBe(true);
    expect(resultado.snapshotAtivo).toBe(remoto);
    expect(resultado.snapshotPendente).toBeNull();
  });
});
