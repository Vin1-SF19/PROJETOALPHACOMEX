/**
 * Cláusula `where` da listagem de extratos. Desde a Fase 3.3 do Cliente Master
 * (2026-08-13), razão social e CNPJ vivem em `Cliente` (relação), enquanto
 * `analistaResponsavel` continua em `Extratos` — por isso os filtros não podem
 * mais ser um array OR plano de um só nível; a razão social/CNPJ precisam vir
 * aninhados em `cliente`.
 */
export type WherePesquisaExtrato = {
  OR: Array<
    | { cliente: { razaoSocial: { contains: string } } }
    | { cliente: { cnpj: { contains: string } } }
    | { analistaResponsavel: { contains: string } }
  >;
} | Record<string, never>;

/**
 * Monta a condição OR da listagem sem criar `contains: ""` para CNPJ.
 * Razões sociais são persistidas em caixa alta pelo módulo, por isso o termo
 * textual usa a mesma normalização.
 */
export function criarFiltrosPesquisaExtratos(
  busca: string | null | undefined,
): WherePesquisaExtrato {
  const termo = busca?.trim();
  if (!termo) return {};

  const filtros: WherePesquisaExtrato["OR"] = [
    { cliente: { razaoSocial: { contains: termo.toUpperCase() } } },
    { analistaResponsavel: { contains: termo } },
  ];
  const cnpj = termo.replace(/\D/g, "");

  if (cnpj) filtros.push({ cliente: { cnpj: { contains: cnpj } } });
  return { OR: filtros };
}
