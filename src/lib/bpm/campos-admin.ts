export type EtapaParaAgrupamento = {
  id: string;
  nome: string;
  ordem: number;
};

export type CampoParaAgrupamento = {
  id: string;
  etapaId?: string | null;
  nome: string;
  ordem: number;
  etapaConfiguracoes?: ReadonlyArray<{ etapaId: string; ordem?: number }>;
};

export type GrupoCamposPorColuna<TCampo extends CampoParaAgrupamento> = {
  id: string;
  nome: string;
  tipo: "ETAPA" | "SEM_CONFIGURACAO" | "ASSOCIADO_SEM_ETAPA";
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

/** Projeta a mesma aplicabilidade por etapa usada pelo runtime moderno. */
export function agruparCamposPorColuna<TCampo extends CampoParaAgrupamento>(
  campos: readonly TCampo[],
  etapas: readonly EtapaParaAgrupamento[],
): GrupoCamposPorColuna<TCampo>[] {
  const etapasOrdenadas = [...etapas].sort(
    (left, right) => left.ordem - right.ordem,
  );
  const idsEtapas = new Set(etapasOrdenadas.map((etapa) => etapa.id));
  const camposPorEtapa = new Map<string, TCampo[]>();
  const semConfiguracao: TCampo[] = [];
  const associadosSemEtapa: TCampo[] = [];

  for (const campo of campos) {
    const configuracoes = campo.etapaConfiguracoes ?? [];
    const aplicaveis = configuracoes.filter((config) => idsEtapas.has(config.etapaId));
    if (aplicaveis.length === 0) {
      (configuracoes.length === 0 ? semConfiguracao : associadosSemEtapa).push(campo);
      continue;
    }
    for (const config of aplicaveis) {
      const grupo = camposPorEtapa.get(config.etapaId) ?? [];
      grupo.push({ ...campo, ordem: config.ordem ?? campo.ordem });
      camposPorEtapa.set(config.etapaId, grupo);
    }
  }

  const grupos: GrupoCamposPorColuna<TCampo>[] = [
    ...etapasOrdenadas.map((etapa) => ({
      id: etapa.id,
      nome: etapa.nome,
      tipo: "ETAPA" as const,
      campos: ordenarCampos(camposPorEtapa.get(etapa.id) ?? []),
    })),
  ];

  if (semConfiguracao.length > 0) {
    grupos.push({
      id: "SEM_CONFIGURACAO",
      nome: "Sem configuração por etapa",
      tipo: "SEM_CONFIGURACAO",
      campos: ordenarCampos(semConfiguracao),
    });
  }
  if (associadosSemEtapa.length > 0) {
    grupos.push({
      id: "ASSOCIADO_SEM_ETAPA",
      nome: "Compartilhados sem etapa neste pipeline",
      tipo: "ASSOCIADO_SEM_ETAPA",
      campos: ordenarCampos(associadosSemEtapa),
    });
  }

  return grupos;
}
