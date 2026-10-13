const normalizar = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const nomes = {
  habilitacao: "Habilitação RADAR - 50K",
  limitado: "Revisão RADAR - 150K",
  ilimitado: "Revisão RADAR - ILIMITADO",
};
const produtos = new Map([
  ["Habilitar o RADAR de US$ 50 mil semestrais", nomes.habilitacao],
  ["Revisão do RADAR para a modalidade ILIMITADA", nomes.ilimitado],
  ["Revisão do RADAR para a modalidade Limitada a US$ 150 mil semestrais", nomes.limitado],
  ["Processo de Revisão de estimativa do RADAR - MODALIDADE ILIMITADA", nomes.ilimitado],
  ["Processo de Revisão de estimativa do RADAR - MODALIDADE 150 MIL DÓLARES SEMESTRAIS", nomes.limitado],
].map(([key, value]) => [normalizar(key), value]));
const modalidades = new Map([
  ["Modalidade ilimitada", nomes.ilimitado],
  ["Modalidade de 150 mil dólares semestrais", nomes.limitado],
  ["Habilitação", nomes.habilitacao],
].map(([key, value]) => [normalizar(key), value]));

type Deal = {
  deal_products?: { name?: string; product?: { name?: string } }[];
  deal_custom_fields?: { value?: unknown; custom_field?: { label?: string; name?: string } }[];
};

/** Serviço do negócio, não comprovação de contratação: nunca inferir pelo CNPJ ou pelo funil. */
export function resolverServicoRd(deal: Deal) {
  const encontrados = new Set<string>();
  const evidencias: string[] = [];
  let desconhecido = false;
  for (const product of deal.deal_products ?? []) {
    const nome = product.name ?? product.product?.name ?? "";
    const servico = produtos.get(normalizar(nome));
    if (!servico) { desconhecido = true; continue; }
    encontrados.add(servico);
    evidencias.push(`produto RD: ${nome}`);
  }
  for (const field of deal.deal_custom_fields ?? []) {
    if (normalizar(field.custom_field?.label ?? field.custom_field?.name ?? "") !== "radar pretendido") continue;
    if (field.value == null || field.value === "") continue;
    const servico = typeof field.value === "string" ? modalidades.get(normalizar(field.value)) : undefined;
    if (!servico) { desconhecido = true; continue; }
    encontrados.add(servico);
    evidencias.push(`Radar pretendido RD: ${String(field.value).trim()}`);
  }
  const motivo = desconhecido ? "valor_nao_mapeado" : encontrados.size > 1 ? "servicos_divergentes" : encontrados.size === 0 ? "sem_evidencia_no_negocio" : null;
  return { servico: motivo ? null : [...encontrados][0], candidatos: [...encontrados], evidencias, motivo };
}
