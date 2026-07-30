export const BLUEPRINT_PREMIO_MAX_CENTS = 2_147_483_647;

export type ResultadoParsePremio =
  | { success: true; value: number | null }
  | { success: false; error: string };

const formatadorPremio = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatadorPremioInput = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatarPremioBRL(premioCents: number): string {
  return formatadorPremio.format(premioCents / 100);
}

export function formatarPremioParaInput(premioCents: number | null | undefined): string {
  if (premioCents === null || premioCents === undefined) return "";
  return formatadorPremioInput.format(premioCents / 100);
}

export function parsePremioReaisParaCents(valor: string): ResultadoParsePremio {
  const limpo = valor.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!limpo) return { success: true, value: null };
  if (limpo.startsWith("-")) return { success: false, error: "O prêmio não pode ser negativo" };

  let reais: string;
  let centavos = "";

  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(limpo)) {
    const [parteInteira, parteDecimal = ""] = limpo.split(",");
    reais = parteInteira.replaceAll(".", "");
    centavos = parteDecimal;
  } else if (/^\d+(?:,\d{1,2})?$/.test(limpo)) {
    [reais, centavos = ""] = limpo.split(",");
  } else if (/^\d+(?:\.\d{1,2})?$/.test(limpo)) {
    [reais, centavos = ""] = limpo.split(".");
  } else {
    return { success: false, error: "Informe um valor monetário válido, como 1.500,00" };
  }

  const total = BigInt(reais) * BigInt(100) + BigInt(centavos.padEnd(2, "0"));
  if (total > BigInt(BLUEPRINT_PREMIO_MAX_CENTS)) {
    return { success: false, error: "O prêmio informado excede o valor máximo permitido" };
  }

  return { success: true, value: Number(total) };
}

export function podeAlterarPremioBlueprint(createdById: number, userId: number): boolean {
  return createdById === userId;
}
