const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;

export const PLACEHOLDERS_AUTOMACAO_BPM = [
  "card.id",
  "card.servico",
  "empresa.razaoSocial",
  "empresa.nomeFantasia",
  "empresa.cnpj",
  "responsavel.nome",
  "pipeline.nome",
  "coluna.nome",
] as const;

export function renderizarPlaceholdersAutomacaoBpm(
  valor: string,
  contexto: Record<string, string>,
): string {
  return valor.replace(PLACEHOLDER_PATTERN, (original, chave: string) =>
    Object.prototype.hasOwnProperty.call(contexto, chave)
      ? contexto[chave]
      : original,
  );
}
export function escaparHtmlAutomacaoBpm(valor: string): string {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
