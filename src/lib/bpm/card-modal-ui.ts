import {
  campoEhMotivoLost,
  campoEhMotivoLostOutro,
  etapaEhLost,
  motivoLostExigeComplemento,
} from "@/lib/bpm/lost";
import { BPM_FIELD_KEYS, BPM_STAGE_KEYS } from "@/lib/bpm/ontology";

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

/** Three-way merge: a card revision alone does not prove a field conflict. */
export function resolverSnapshotCamposRealtime(params: {
  rascunhoSujo: boolean;
  snapshotAtual: SnapshotCamposRealtime;
  snapshotRemoto: SnapshotCamposRealtime;
  valoresLocais?: Record<string, string>;
}) {
  const { snapshotAtual: base, snapshotRemoto: remoto, valoresLocais } = params;
  const idsLocais = new Set([...Object.keys(base.valores), ...Object.keys(valoresLocais ?? {})]);
  const conflitos = params.rascunhoSujo && (!valoresLocais || [...idsLocais].some((id) =>
    valoresLocais[id] !== base.valores[id]
    && remoto.valores[id] !== base.valores[id]
    && remoto.valores[id] !== valoresLocais[id]));
  if (conflitos) return {
    aplicarRemoto: false as const,
    snapshotAtivo: base,
    snapshotPendente: remoto,
    valoresEditados: valoresLocais ?? base.valores,
  };
  const valoresEditados = { ...remoto.valores };
  if (params.rascunhoSujo && valoresLocais) {
    for (const id of idsLocais) {
      if (valoresLocais[id] !== base.valores[id]) {
        if (Object.hasOwn(valoresLocais, id)) valoresEditados[id] = valoresLocais[id];
        else delete valoresEditados[id];
      }
    }
  }
  return {
    aplicarRemoto: true as const,
    snapshotAtivo: remoto,
    snapshotPendente: null,
    valoresEditados,
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

export function prepararCamposMotivoLostUiCanonico<
  T extends CampoMotivoLostUi & { chave?: string | null },
>(
  etapaChave: string | null | undefined,
  campos: T[],
  valores: Readonly<Record<string, string>>,
) {
  if (etapaChave !== BPM_STAGE_KEYS.LOST) {
    return {
      camposVisiveis: campos,
      campoMotivoId: null,
      campoComplementoId: null,
      exigeComplemento: false,
    };
  }

  const campoMotivo = campos.find(
    (campo) => campo.chave === BPM_FIELD_KEYS.LOST_REASON,
  );
  const campoComplemento = campos.find(
    (campo) => campo.chave === BPM_FIELD_KEYS.LOST_REASON_OTHER,
  );
  const exigeComplemento = Boolean(
    campoMotivo && motivoLostExigeComplemento(valores[campoMotivo.id]),
  );

  return {
    camposVisiveis: campos
      .filter(
        (campo) =>
          campo.chave !== BPM_FIELD_KEYS.LOST_REASON_OTHER || exigeComplemento,
      )
      .map((campo) =>
        campo.chave === BPM_FIELD_KEYS.LOST_REASON_OTHER
          ? { ...campo, obrigatorio: true }
          : campo,
      ),
    campoMotivoId: campoMotivo?.id ?? null,
    campoComplementoId: campoComplemento?.id ?? null,
    exigeComplemento,
  };
}
