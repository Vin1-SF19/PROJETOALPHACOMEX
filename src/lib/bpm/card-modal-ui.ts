import {
  campoEhMotivoLost,
  campoEhMotivoLostOutro,
  etapaEhLost,
  motivoLostExigeComplemento,
} from "@/lib/bpm/lost";
import { BPM_FIELD_KEYS, BPM_STAGE_KEYS } from "@/lib/bpm/ontology";
import { campoEhOrigemCliente } from "@/lib/bpm/origem-cliente";

export const CHAVE_TARIFARIO_PADRAO = "alpha.radar.fechado.tarifario_padrao";
export const CHAVE_CONDICAO_NEGOCIADA = "alpha.radar.contrato.condicao_negociada";
const CHAVE_PARCEIRO_RESPONSAVEL = "alpha.radar.contrato.parceiro_responsavel";

type CampoCondicionalComercial = {
  id: string;
  nome?: string;
  chave?: string | null;
  condicaoVisibilidadeJson?: string | null;
};

/** Apenas a dependência publicada e simples do tarifário pode antecipar a UI.
 * Condições de outros campos continuam sendo resolvidas exclusivamente no servidor. */
export function controladorTarifarioNegociado(
  campo: CampoCondicionalComercial,
  campos: readonly CampoCondicionalComercial[],
): string | null {
  if (campo.chave !== CHAVE_CONDICAO_NEGOCIADA || !campo.condicaoVisibilidadeJson) return null;
  const tarifarios = campos.filter((item) => item.chave === CHAVE_TARIFARIO_PADRAO);
  if (tarifarios.length !== 1) return null;
  try {
    const grupo = JSON.parse(campo.condicaoVisibilidadeJson);
    const condicao = grupo?.condicoes?.[0];
    return grupo?.operador === "AND" && Array.isArray(grupo.condicoes) && grupo.condicoes.length === 1
      && condicao?.tipo === "condicao" && condicao.operador === "igual"
      && condicao.campo?.fonte === "campo_dinamico" && condicao.campo.campo === tarifarios[0].id
      && condicao.valor === "Não" && !condicao.valorCampo
      && (!condicao.tipoEsperado || condicao.tipoEsperado === "texto")
      ? tarifarios[0].id : null;
  } catch { return null; }
}

/** Filtra apresentação, sem apagar o rascunho nem alterar a autorização do campo. */
export function filtrarCamposComerciaisUi<T extends CampoCondicionalComercial>(
  campos: readonly T[],
  valores: Readonly<Record<string, string>>,
  catalogo: readonly CampoCondicionalComercial[] = campos,
): T[] {
  const possuiOrigem = catalogo.some((campo) => campoEhOrigemCliente({ nome: campo.nome ?? "", chave: campo.chave }));
  return campos.filter((campo) => {
    if (possuiOrigem && campo.chave === CHAVE_PARCEIRO_RESPONSAVEL) return false;
    const controlador = controladorTarifarioNegociado(campo, catalogo);
    return !controlador || valores[controlador] === "Não";
  });
}

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
