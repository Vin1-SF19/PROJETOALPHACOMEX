import db from "@/lib/prisma";

/**
 * Busca o `ClienteServico` correspondente a um CNPJ+serviço, usado pelo merger
 * (company-event-merger.ts) para casar um ContratoComercial com seu serviço
 * correspondente no CS&NPS. Fase 3.6 do Cliente Master (2026-08-14): `clientes`
 * (legado) foi substituída por `Cliente`+`ClienteServico` — casamento agora via
 * `cliente.cnpj` (normalizado) + `servico`.
 */
export async function buscarClientePorCnpjEServico(cnpj: string, servico: string): Promise<{ id: number } | null> {
  const cnpjNormalizado = cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return db.clienteServico.findFirst({
    where: { servico, cliente: { cnpj: cnpjNormalizado } },
    select: { id: true },
  });
}
