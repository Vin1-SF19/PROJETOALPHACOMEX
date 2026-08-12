export type CampoObrigatorioBpm = {
  id: string;
  nome: string;
};

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

