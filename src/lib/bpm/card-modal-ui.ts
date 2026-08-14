import {
  campoEhMotivoLost,
  campoEhMotivoLostOutro,
  etapaEhLost,
  motivoLostExigeComplemento,
} from "@/lib/bpm/lost";

export type EstadoFollowUpModal = "CARREGANDO" | "ERRO" | "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO";

export function followUpBloqueiaFechamento(
  etapaNome: string | null | undefined,
  estado: EstadoFollowUpModal,
): boolean {
  if (etapaNome?.trim().toLocaleLowerCase("pt-BR") !== "em tratativa") return false;
  return estado === "CARREGANDO" || estado === "ERRO" || estado === "EM_ANDAMENTO";
}

export type CampoRequisitoUi = { id: string; contexto: "ORIGEM" | "DESTINO" | "AMBOS" };

export function separarCamposRequisitos<T extends CampoRequisitoUi>(campos: T[], idsEtapaAtual: Set<string>) {
  const origem: T[] = [];
  const editaveisDestino: T[] = [];
  for (const campo of campos) {
    if (campo.contexto === "ORIGEM" || idsEtapaAtual.has(campo.id)) origem.push(campo);
    else editaveisDestino.push(campo);
  }
  return { origem, editaveisDestino };
}

export function montarPayloadCamposDestino<T extends { id: string }>(campos: T[], valores: Record<string, string>) {
  return Object.fromEntries(campos.map((campo) => [campo.id, valores[campo.id] ?? ""]));
}

export type SnapshotCamposRealtime = {
  valores: Record<string, string>;
  versao: string;
};

export function resolverSnapshotCamposRealtime(params: {
  rascunhoSujo: boolean;
  snapshotAtual: SnapshotCamposRealtime;
  snapshotRemoto: SnapshotCamposRealtime;
}) {
  return params.rascunhoSujo
    ? {
        aplicarRemoto: false as const,
        snapshotAtivo: params.snapshotAtual,
        snapshotPendente: params.snapshotRemoto,
      }
    : {
        aplicarRemoto: true as const,
        snapshotAtivo: params.snapshotRemoto,
        snapshotPendente: null,
      };
}

export type CampoMotivoLostUi = {
  id: string;
  nome: string;
  obrigatorio: boolean;
};

export function prepararCamposMotivoLostUi<T extends CampoMotivoLostUi>(
  etapaNome: string | null | undefined,
  campos: T[],
  valores: Readonly<Record<string, string>>,
) {
  if (!etapaEhLost(etapaNome)) {
    return {
      camposVisiveis: campos,
      campoMotivoId: null,
      campoComplementoId: null,
      exigeComplemento: false,
    };
  }

  const campoMotivo = campos.find((campo) => campoEhMotivoLost(campo.nome));
  const campoComplemento = campos.find((campo) => campoEhMotivoLostOutro(campo.nome));
  const exigeComplemento = Boolean(
    campoMotivo && motivoLostExigeComplemento(valores[campoMotivo.id]),
  );

  return {
    camposVisiveis: campos
      .filter((campo) => !campoEhMotivoLostOutro(campo.nome) || exigeComplemento)
      .map((campo) => campoEhMotivoLostOutro(campo.nome)
        ? { ...campo, obrigatorio: true }
        : campo),
    campoMotivoId: campoMotivo?.id ?? null,
    campoComplementoId: campoComplemento?.id ?? null,
    exigeComplemento,
  };
}
