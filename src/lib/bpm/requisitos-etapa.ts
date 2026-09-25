export type CampoObrigatorioBpm = {
  id: string;
  nome: string;
};

export type OrigemMovimentacaoBpm = "MANUAL" | "AUTOMACAO";

type ObrigacaoCampoTransicao = {
  obrigatorio?: boolean;
  obrigatorioEntrada?: boolean;
  obrigatorioSaida?: boolean;
};

/** Campo normal da etapa destino só passa a ser exigido depois que o card entra nela. */
export function campoObrigatorioAoMover(params: {
  origem?: ObrigacaoCampoTransicao;
  destino?: ObrigacaoCampoTransicao;
}): boolean {
  return Boolean(
    params.origem?.obrigatorio
    || params.origem?.obrigatorioSaida
    || params.destino?.obrigatorioEntrada,
  );
}

export function deduplicarCamposObrigatorios(
  campos: CampoObrigatorioBpm[],
): CampoObrigatorioBpm[] {
  return Array.from(new Map(campos.map((campo) => [campo.id, campo])).values());
}

export function listarCamposObrigatoriosFaltantes(
  campos: CampoObrigatorioBpm[],
  valores: Record<string, string | null | undefined>,
): CampoObrigatorioBpm[] {
  return deduplicarCamposObrigatorios(campos).filter(
    (campo) => !valores[campo.id]?.trim(),
  );
}
