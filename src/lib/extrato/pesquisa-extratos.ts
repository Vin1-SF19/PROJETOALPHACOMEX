type CampoPesquisavelExtrato = "razaoSocial" | "cnpj" | "analistaResponsavel";

export type FiltroPesquisaExtrato = Partial<
  Record<CampoPesquisavelExtrato, { contains: string }>
>;

/**
 * Monta as condições OR da listagem sem criar `contains: ""` para CNPJ.
 * Razões sociais são persistidas em caixa alta pelo módulo, por isso o termo
 * textual usa a mesma normalização.
 */
export function criarFiltrosPesquisaExtratos(
  busca: string | null | undefined,
): FiltroPesquisaExtrato[] {
  const termo = busca?.trim();
  if (!termo) return [];

  const filtros: FiltroPesquisaExtrato[] = [
    { razaoSocial: { contains: termo.toUpperCase() } },
    { analistaResponsavel: { contains: termo } },
  ];
  const cnpj = termo.replace(/\D/g, "");

  if (cnpj) filtros.push({ cnpj: { contains: cnpj } });
  return filtros;
}
