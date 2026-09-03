export type EtapaParaAgrupamento = {
  id: string;
  nome: string;
  ordem: number;
};

export type CampoParaAgrupamento = {
  id: string;
  etapaId: string | null;
  nome: string;
  ordem: number;
};

export type GrupoCamposPorColuna<TCampo extends CampoParaAgrupamento> = {
  id: string;
  nome: string;
  tipo: "GERAL" | "ETAPA" | "INDISPONIVEL";
  campos: TCampo[];
};

function ordenarCampos<TCampo extends CampoParaAgrupamento>(
  campos: readonly TCampo[],
): TCampo[] {
  return [...campos].sort(
    (left, right) => left.ordem - right.ordem
      || left.nome.localeCompare(right.nome, "pt-BR"),
  );
}

/**
 * Organiza todos os campos do admin sem alterar a semântica de etapaId:
 * null continua significando um campo geral, aplicável a todas as etapas.
 */
export function agruparCamposPorColuna<TCampo extends CampoParaAgrupamento>(
  campos: readonly TCampo[],
  etapas: readonly EtapaParaAgrupamento[],
): GrupoCamposPorColuna<TCampo>[] {
  const etapasOrdenadas = [...etapas].sort(
    (left, right) => left.ordem - right.ordem,
  );
  const idsEtapas = new Set(etapasOrdenadas.map((etapa) => etapa.id));
  const camposPorEtapa = new Map<string, TCampo[]>();

  for (const campo of campos) {
    const chave = campo.etapaId ?? "GERAL";
    const grupo = camposPorEtapa.get(chave) ?? [];
    grupo.push(campo);
    camposPorEtapa.set(chave, grupo);
  }

  const grupos: GrupoCamposPorColuna<TCampo>[] = [
    {
      id: "GERAL",
      nome: "Todas as etapas",
      tipo: "GERAL",
      campos: ordenarCampos(camposPorEtapa.get("GERAL") ?? []),
    },
    ...etapasOrdenadas.map((etapa) => ({
      id: etapa.id,
      nome: etapa.nome,
      tipo: "ETAPA" as const,
      campos: ordenarCampos(camposPorEtapa.get(etapa.id) ?? []),
    })),
  ];

  const indisponiveis = campos.filter(
    (campo) => campo.etapaId !== null && !idsEtapas.has(campo.etapaId),
  );
  if (indisponiveis.length > 0) {
    grupos.push({
      id: "INDISPONIVEL",
      nome: "Etapa inativa ou indisponível",
      tipo: "INDISPONIVEL",
      campos: ordenarCampos(indisponiveis),
    });
  }

  return grupos;
}
