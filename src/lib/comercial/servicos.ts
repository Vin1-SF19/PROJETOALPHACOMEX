export const SERVICOS_COMERCIAIS_PADRAO = [
  "Habilitação RADAR - 50K",
  "Revisão RADAR - 150K",
  "Revisão RADAR - ILIMITADO",
  "TTD 409",
  "Recuperação AFRMM",
  "Outras Recuperações Tributárias",
] as const;

export function normalizarNomeServico(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}
